import { getEffectiveShopifySyncStore } from "@/lib/shopifySyncRuntime";
import { getShopifyCommerceConfig } from "@/lib/shopifyCommerce";
import { getShopifySyncSchedulerSettings } from "@/lib/shopifySyncScheduler";
import { resolveShopifyConnectionSettings } from "@/lib/shopifyConnection";
import { getCustomers } from "@/lib/shopify";

type CapabilityKey =
  | "payments"
  | "checkout"
  | "customer_accounts"
  | "shipping_delivery"
  | "taxes_duties"
  | "inventory_stock"
  | "notifications"
  | "customer_policy"
  | "two_way_sync";

type CapabilityStatus = {
  key: CapabilityKey;
  label: string;
  enabledInCms: boolean;
  live: boolean;
  detail: string;
};

async function getGrantedScopes() {
  try {
    const { storeDomain, accessToken } = await resolveShopifyConnectionSettings();
    const scopesRes = await fetch(`https://${storeDomain}/admin/oauth/access_scopes.json`, {
      headers: {
        "X-Shopify-Access-Token": accessToken,
        "Content-Type": "application/json",
      },
      cache: "no-store",
    });
    if (!scopesRes.ok) {
      return [];
    }
    const scopesJson = (await scopesRes.json()) as {
      access_scopes?: Array<{ handle?: string }>;
    };
    return Array.isArray(scopesJson.access_scopes)
      ? scopesJson.access_scopes.map((item) => item.handle || "").filter(Boolean)
      : [];
  } catch {
    return [];
  }
}

export async function GET() {
  try {
    const [syncStore, cmsConfig, scheduler, scopes] = await Promise.all([
      getEffectiveShopifySyncStore().catch(() => null),
      getShopifyCommerceConfig(),
      getShopifySyncSchedulerSettings(),
      getGrantedScopes(),
    ]);

    const products = syncStore?.payload?.products || [];
    const categories = syncStore?.payload?.categories || [];
    const inventoryUnits = products.reduce(
      (sum, product) =>
        sum +
        (product.variants || []).reduce(
          (inner, variant) => inner + Number(variant.inventory_quantity || 0),
          0
        ),
      0
    );
    const lowStockCount = products.filter((product) => {
      const qty = (product.variants || []).reduce(
        (inner, variant) => inner + Number(variant.inventory_quantity || 0),
        0
      );
      return qty > 0 && qty <= 5;
    }).length;
    const outOfStockCount = products.filter((product) => {
      const qty = (product.variants || []).reduce(
        (inner, variant) => inner + Number(variant.inventory_quantity || 0),
        0
      );
      return qty <= 0;
    }).length;

    const canDraftOrders = scopes.includes("write_draft_orders");
    const canCustomersRead = scopes.includes("read_customers");
    const canCustomersWrite = scopes.includes("write_customers");
    const canProductsRead = scopes.includes("read_products");
    const canProductsWrite = scopes.includes("write_products");
    const canOrdersRead = scopes.includes("read_orders");

    const sampleCustomers = canCustomersRead ? await getCustomers(5).catch(() => []) : [];

    const capabilities: CapabilityStatus[] = [
      {
        key: "payments",
        label: "Payments",
        enabledInCms: cmsConfig.enablePayments,
        live: cmsConfig.enablePayments && canDraftOrders,
        detail: canDraftOrders
          ? "Shopify draft-order payment links are available."
          : "Missing write_draft_orders scope.",
      },
      {
        key: "checkout",
        label: "Checkout",
        enabledInCms: cmsConfig.enableCheckout,
        live: cmsConfig.enableCheckout && canDraftOrders,
        detail: canDraftOrders
          ? "Checkout creates Shopify draft orders."
          : "Checkout blocked until draft-order scope is granted.",
      },
      {
        key: "customer_accounts",
        label: "Customer accounts",
        enabledInCms: cmsConfig.enableCustomerAccounts,
        live: cmsConfig.enableCustomerAccounts && (canCustomersRead || canCustomersWrite),
        detail:
          canCustomersRead || canCustomersWrite
            ? "Customer profile sync is available with Shopify."
            : "Missing customer read/write scopes.",
      },
      {
        key: "shipping_delivery",
        label: "Shipping & delivery",
        enabledInCms: cmsConfig.enableShippingDelivery,
        live: cmsConfig.enableShippingDelivery,
        detail: `Flat shipping INR ${cmsConfig.shippingFlatRate} configured in CMS.`,
      },
      {
        key: "taxes_duties",
        label: "Taxes & duties",
        enabledInCms: cmsConfig.enableTaxesDuties,
        live: cmsConfig.enableTaxesDuties,
        detail: `Tax rate ${cmsConfig.taxRatePct}% configured in CMS.`,
      },
      {
        key: "inventory_stock",
        label: "Inventory / stock",
        enabledInCms: cmsConfig.enableInventoryStock,
        live: cmsConfig.enableInventoryStock && canProductsRead,
        detail: canProductsRead
          ? "Live stock is synced from Shopify products."
          : "Missing read_products scope.",
      },
      {
        key: "notifications",
        label: "Notifications",
        enabledInCms: cmsConfig.enableNotifications,
        live: cmsConfig.enableNotifications,
        detail: `Operational notifications routed to ${cmsConfig.notificationEmail}.`,
      },
      {
        key: "customer_policy",
        label: "Customer policy",
        enabledInCms: cmsConfig.enableCustomerPolicy,
        live: cmsConfig.enableCustomerPolicy,
        detail: "Warranty, returns, shipping, and privacy policy text configured.",
      },
      {
        key: "two_way_sync",
        label: "2-way sync",
        enabledInCms: cmsConfig.enableTwoWaySync,
        live:
          cmsConfig.enableTwoWaySync &&
          canProductsRead &&
          (canProductsWrite || canCustomersWrite || canOrdersRead || canDraftOrders),
        detail:
          canProductsWrite || canCustomersWrite
            ? "Read + write sync available through Shopify APIs."
            : "Read sync works; grant write scopes for full 2-way sync.",
      },
    ];

    return Response.json({
      config: cmsConfig,
      policies: {
        shipping: cmsConfig.shippingPolicy,
        returns: cmsConfig.returnsPolicy,
        warranty: cmsConfig.warrantyPolicy,
        privacy: cmsConfig.privacyPolicy,
      },
      schedulerMode: scheduler.mode,
      syncedAt: syncStore?.syncedAt || "",
      scopes,
      metrics: {
        categories: categories.length,
        products: products.length,
        inventoryUnits,
        lowStockCount,
        outOfStockCount,
        sampleCustomers: sampleCustomers.length,
      },
      capabilities,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to compute commerce status.";
    return Response.json({ error: message }, { status: 500 });
  }
}

import "server-only";
import { promises as fs } from "node:fs";
import path from "node:path";

export type ShopifyCommerceConfig = {
  enablePayments: boolean;
  enableCheckout: boolean;
  enableCustomerAccounts: boolean;
  enableShippingDelivery: boolean;
  enableTaxesDuties: boolean;
  enableInventoryStock: boolean;
  enableNotifications: boolean;
  enableCustomerPolicy: boolean;
  enableTwoWaySync: boolean;
  notificationEmail: string;
  shippingPolicy: string;
  returnsPolicy: string;
  warrantyPolicy: string;
  privacyPolicy: string;
  taxRatePct: number;
  shippingFlatRate: number;
};

const configPath = path.join(process.cwd(), "data", "shopify-commerce.json");

export const defaultShopifyCommerceConfig: ShopifyCommerceConfig = {
  enablePayments: true,
  enableCheckout: true,
  enableCustomerAccounts: true,
  enableShippingDelivery: true,
  enableTaxesDuties: true,
  enableInventoryStock: true,
  enableNotifications: true,
  enableCustomerPolicy: true,
  enableTwoWaySync: true,
  notificationEmail: "support@revampfy.in",
  shippingPolicy: "Orders are dispatched in 24-48 hours with tracking updates.",
  returnsPolicy: "Returns accepted within 7 days for eligible products.",
  warrantyPolicy: "Certified products include warranty support as listed on product pages.",
  privacyPolicy: "Customer data is used for fulfilment, support, and compliance only.",
  taxRatePct: 18,
  shippingFlatRate: 199,
};

export async function getShopifyCommerceConfig(): Promise<ShopifyCommerceConfig> {
  try {
    const raw = await fs.readFile(configPath, "utf8");
    const parsed = JSON.parse(raw) as Partial<ShopifyCommerceConfig>;
    return {
      ...defaultShopifyCommerceConfig,
      ...parsed,
      taxRatePct: Number.isFinite(Number(parsed.taxRatePct))
        ? Number(parsed.taxRatePct)
        : defaultShopifyCommerceConfig.taxRatePct,
      shippingFlatRate: Number.isFinite(Number(parsed.shippingFlatRate))
        ? Number(parsed.shippingFlatRate)
        : defaultShopifyCommerceConfig.shippingFlatRate,
    };
  } catch {
    return defaultShopifyCommerceConfig;
  }
}

export async function saveShopifyCommerceConfig(
  next: Partial<ShopifyCommerceConfig>
): Promise<ShopifyCommerceConfig> {
  const current = await getShopifyCommerceConfig();
  const normalized: ShopifyCommerceConfig = {
    ...current,
    ...next,
    taxRatePct: Number.isFinite(Number(next.taxRatePct))
      ? Number(next.taxRatePct)
      : current.taxRatePct,
    shippingFlatRate: Number.isFinite(Number(next.shippingFlatRate))
      ? Number(next.shippingFlatRate)
      : current.shippingFlatRate,
  };
  await fs.mkdir(path.dirname(configPath), { recursive: true });
  await fs.writeFile(configPath, JSON.stringify(normalized, null, 2), "utf8");
  return normalized;
}

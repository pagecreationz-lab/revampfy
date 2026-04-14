import { NextResponse } from "next/server";
import {
  getShopifyCommerceConfig,
  saveShopifyCommerceConfig,
} from "@/lib/shopifyCommerce";

export async function GET() {
  const config = await getShopifyCommerceConfig();
  return NextResponse.json({ config });
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as Record<string, unknown>;
    const config = await saveShopifyCommerceConfig({
      enablePayments: Boolean(payload.enablePayments),
      enableCheckout: Boolean(payload.enableCheckout),
      enableCustomerAccounts: Boolean(payload.enableCustomerAccounts),
      enableShippingDelivery: Boolean(payload.enableShippingDelivery),
      enableTaxesDuties: Boolean(payload.enableTaxesDuties),
      enableInventoryStock: Boolean(payload.enableInventoryStock),
      enableNotifications: Boolean(payload.enableNotifications),
      enableCustomerPolicy: Boolean(payload.enableCustomerPolicy),
      enableTwoWaySync: Boolean(payload.enableTwoWaySync),
      notificationEmail: String(payload.notificationEmail || "").trim(),
      shippingPolicy: String(payload.shippingPolicy || "").trim(),
      returnsPolicy: String(payload.returnsPolicy || "").trim(),
      warrantyPolicy: String(payload.warrantyPolicy || "").trim(),
      privacyPolicy: String(payload.privacyPolicy || "").trim(),
      taxRatePct: Number(payload.taxRatePct || 0),
      shippingFlatRate: Number(payload.shippingFlatRate || 0),
    });
    return NextResponse.json({ ok: true, config });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to save commerce config.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

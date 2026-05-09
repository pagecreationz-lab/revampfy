import { NextResponse } from "next/server";
import {
  getCatalogCommerceConfig,
  saveCatalogCommerceConfig,
} from "@/lib/catalogCommerce";

export const dynamic = "force-dynamic";

export async function GET() {
  const config = await getCatalogCommerceConfig();
  return NextResponse.json(
    { config },
    {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
      },
    }
  );
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as Record<string, unknown>;
    const config = await saveCatalogCommerceConfig({
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
      paymentGateway:
        payload.paymentGateway === "razorpay" ||
        payload.paymentGateway === "payu" ||
        payload.paymentGateway === "cod"
          ? payload.paymentGateway
          : "manual",
      razorpayEnabled: Boolean(payload.razorpayEnabled),
      enableCod: Boolean(payload.enableCod),
      requireGpsForCod: Boolean(payload.requireGpsForCod),
      requireGpsForAllPayments: Boolean(payload.requireGpsForAllPayments),
      payuEnabled: Boolean(payload.payuEnabled),
      payuKey: String(payload.payuKey || "").trim(),
      payuSalt: String(payload.payuSalt || "").trim(),
      payuAuthHeader: String(payload.payuAuthHeader || "").trim(),
      payuWebhookSecret: String(payload.payuWebhookSecret || "").trim(),
      shiprocketEnabled: Boolean(payload.shiprocketEnabled),
      shiprocketEmail: String(payload.shiprocketEmail || "").trim(),
      shiprocketPassword: String(payload.shiprocketPassword || "").trim(),
      shiprocketPickupLocation: String(payload.shiprocketPickupLocation || "").trim(),
      shiprocketWebhookSecret: String(payload.shiprocketWebhookSecret || "").trim(),
      razorpayKeyId: String(payload.razorpayKeyId || "").trim(),
      razorpayKeySecret: String(payload.razorpayKeySecret || "").trim(),
    });
    return NextResponse.json({ ok: true, config });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to save commerce config.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}


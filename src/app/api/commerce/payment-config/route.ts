import { getCatalogCommerceConfig } from "@/lib/catalogCommerce";

export const dynamic = "force-dynamic";

export async function GET() {
  const config = await getCatalogCommerceConfig();
  return Response.json(
    {
      paymentGateway: config.paymentGateway || "manual",
      enableCod: Boolean(config.enableCod),
      requireGpsForCod: Boolean(config.requireGpsForCod),
      requireGpsForAllPayments: Boolean(config.requireGpsForAllPayments ?? true),
      payuEnabled: Boolean(config.payuEnabled),
      payuKey: config.payuKey || "",
      razorpayEnabled: Boolean(config.razorpayEnabled ?? (config.paymentGateway === "razorpay" || Boolean(config.razorpayKeyId))),
      razorpayKeyId: config.razorpayKeyId || "",
    },
    {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
      },
    }
  );
}


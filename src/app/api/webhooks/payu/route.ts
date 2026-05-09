import { completeDraftOrderPaid, getDraftOrderSnapshot, markDraftOrderFailed } from "@/lib/catalog";
import { createShiprocketShipment } from "@/lib/shiprocket";
import { getCatalogCommerceConfig } from "@/lib/catalogCommerce";
import crypto from "node:crypto";

export async function POST(request: Request) {
  try {
    const config = await getCatalogCommerceConfig();
    if (!config.payuWebhookSecret) {
      return Response.json({ error: "PayU webhook secret not configured." }, { status: 400 });
    }
    const rawBody = await request.text();
    const signatureHeader = String(request.headers.get("x-payu-signature") || "").trim().toLowerCase();
    const expected = crypto
      .createHmac("sha256", config.payuWebhookSecret)
      .update(rawBody)
      .digest("hex")
      .toLowerCase();
    if (!signatureHeader || signatureHeader !== expected) {
      return Response.json({ error: "Invalid PayU webhook signature." }, { status: 401 });
    }
    const payload = JSON.parse(rawBody) as Record<string, unknown>;
    const draftOrderId = Number(payload?.draftOrderId || payload?.udf1 || 0);
    const status = String(payload?.status || "").toLowerCase();
    const txnid = String(payload?.txnid || "");
    if (!draftOrderId) return Response.json({ ok: true });

    if (status === "success") {
      await completeDraftOrderPaid(draftOrderId, {
        paymentId: txnid || `PAYU-${draftOrderId}`,
        paymentMethod: "payu",
        transactionStatus: "paid",
      });
      const draft = await getDraftOrderSnapshot(draftOrderId);
      await createShiprocketShipment({
        draftOrderId,
        orderRef: String(draft.name || draftOrderId),
        customerEmail: draft.email,
        customerPhone: String(draft.mobile || ""),
        shippingAddress: String(draft.address || ""),
        totalAmount: Number(draft.totalPrice || 0),
      }).catch(() => undefined);
    } else {
      await markDraftOrderFailed(draftOrderId).catch(() => undefined);
    }
    return Response.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Webhook failed.";
    return Response.json({ error: message }, { status: 500 });
  }
}

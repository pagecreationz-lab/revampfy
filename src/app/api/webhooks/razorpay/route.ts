import { completeDraftOrderPaid, getDraftOrderSnapshot, markDraftOrderFailed } from "@/lib/catalog";
import { getCatalogCommerceConfig } from "@/lib/catalogCommerce";
import { createShiprocketShipment } from "@/lib/shiprocket";
import crypto from "node:crypto";

export async function POST(request: Request) {
  try {
    const config = await getCatalogCommerceConfig();
    if (!config.razorpayKeySecret) {
      return Response.json({ error: "Razorpay secret missing." }, { status: 400 });
    }
    const rawBody = await request.text();
    const signatureHeader = String(request.headers.get("x-razorpay-signature") || "").trim();
    const expected = crypto
      .createHmac("sha256", config.razorpayKeySecret)
      .update(rawBody)
      .digest("hex");
    if (!signatureHeader || signatureHeader !== expected) {
      return Response.json({ error: "Invalid Razorpay webhook signature." }, { status: 401 });
    }
    const payload = JSON.parse(rawBody) as Record<string, unknown>;
    const webhookPayload = payload as {
      draftOrderId?: number | string;
      razorpayOrderId?: string;
      razorpayPaymentId?: string;
      status?: string;
      event?: string;
      payload?: {
        payment?: {
          entity?: {
            id?: string;
            order_id?: string;
            notes?: { Catalog_draft_order_id?: string | number };
          };
        };
      };
    };
    const draftOrderId = Number(
      webhookPayload.draftOrderId ||
        webhookPayload.payload?.payment?.entity?.notes?.Catalog_draft_order_id ||
        0
    );
    const orderId = String(
      webhookPayload.razorpayOrderId ||
        webhookPayload.payload?.payment?.entity?.order_id ||
        ""
    );
    const paymentId = String(
      webhookPayload.razorpayPaymentId ||
        webhookPayload.payload?.payment?.entity?.id ||
        ""
    );
    const status = String(webhookPayload.status || webhookPayload.event || "").toLowerCase();
    if (!draftOrderId) return Response.json({ ok: true });

    if (status.includes("fail")) {
      await markDraftOrderFailed(draftOrderId).catch(() => undefined);
      return Response.json({ ok: true });
    }

    if (!orderId && !paymentId) {
      return Response.json({ ok: true });
    }

    await completeDraftOrderPaid(draftOrderId, {
      paymentId,
      paymentMethod: "razorpay",
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
    return Response.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Webhook failed.";
    return Response.json({ error: message }, { status: 500 });
  }
}

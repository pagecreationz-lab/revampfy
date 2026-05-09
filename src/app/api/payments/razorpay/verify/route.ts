import { readSessionFromRequest, verifySessionToken } from "@/lib/auth";
import { completeDraftOrderPaid, getDraftOrderSnapshot, markDraftOrderFailed } from "@/lib/catalog";
import { getCatalogCommerceConfig } from "@/lib/catalogCommerce";
import { verifyRazorpaySignature } from "@/lib/razorpay";
import { createShiprocketShipment } from "@/lib/shiprocket";

export async function POST(request: Request) {
  const token = readSessionFromRequest(request);
  const session = verifySessionToken(token);
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const config = await getCatalogCommerceConfig();
    if (config.paymentGateway !== "razorpay") {
      return Response.json({ error: "Razorpay gateway is disabled in CMS." }, { status: 403 });
    }
    if (!config.razorpayKeySecret) {
      return Response.json({ error: "Razorpay secret key is missing in CMS." }, { status: 400 });
    }

    const payload = await request.json();
    const razorpayOrderId = String(payload?.razorpayOrderId || "").trim();
    const razorpayPaymentId = String(payload?.razorpayPaymentId || "").trim();
    const razorpaySignature = String(payload?.razorpaySignature || "").trim();
    const draftOrderId = Number(payload?.draftOrderId || 0);

    if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature || !draftOrderId) {
      return Response.json({ error: "Missing Razorpay verification payload." }, { status: 400 });
    }

    const verified = verifyRazorpaySignature({
      orderId: razorpayOrderId,
      paymentId: razorpayPaymentId,
      signature: razorpaySignature,
      keySecret: config.razorpayKeySecret,
    });
    if (!verified) {
      if (draftOrderId) {
        await markDraftOrderFailed(draftOrderId).catch(() => undefined);
      }
      return Response.json({ error: "Invalid Razorpay payment signature." }, { status: 400 });
    }

    const completed = await completeDraftOrderPaid(draftOrderId, {
      paymentId: razorpayPaymentId,
      transactionStatus: "paid",
      paymentMethod: "razorpay",
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
    return Response.json({
      ok: true,
      message: "Payment captured successfully and synced to Catalog.",
      CatalogDraftOrder: completed,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Razorpay verification failed.";
    return Response.json({ error: message }, { status: 500 });
  }
}



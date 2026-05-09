import { readSessionFromRequest, verifySessionToken } from "@/lib/auth";
import { createDraftOrder } from "@/lib/catalog";
import { getCatalogCommerceConfig } from "@/lib/catalogCommerce";
import { createRazorpayOrder } from "@/lib/razorpay";

type CartLine = { variantId: number; quantity: number };

export async function POST(request: Request) {
  const token = readSessionFromRequest(request);
  const session = verifySessionToken(token);
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const config = await getCatalogCommerceConfig();
    if (config.paymentGateway !== "razorpay") {
      return Response.json({ error: "Razorpay gateway is disabled in CMS." }, { status: 403 });
    }
    if (!config.razorpayKeyId || !config.razorpayKeySecret) {
      return Response.json({ error: "Razorpay keys are not configured in CMS." }, { status: 400 });
    }

    const payload = await request.json();
    const email = String(payload?.email || session.email || "").trim().toLowerCase();
    const total = Number(payload?.total || 0);
    const mobile = String(payload?.mobile || "").trim();
    const address = String(payload?.address || "").trim();
    const street = String(payload?.street || "").trim();
    const area = String(payload?.area || "").trim();
    const city = String(payload?.city || "").trim();
    const state = String(payload?.state || "").trim();
    const pincode = String(payload?.pincode || "").trim();
    const location = payload?.location as { lat?: string; lng?: string } | undefined;
    const lineItems = Array.isArray(payload?.lineItems)
      ? (payload.lineItems as CartLine[])
      : [];
    const sanitizedItems = lineItems
      .map((line) => ({
        variantId: Number(line.variantId),
        quantity: Math.max(1, Number(line.quantity) || 1),
      }))
      .filter((line) => Number.isFinite(line.variantId) && line.variantId > 0);

    if (!email) return Response.json({ error: "Email is required." }, { status: 400 });
    if (!sanitizedItems.length) {
      return Response.json({ error: "No valid cart items found." }, { status: 400 });
    }
    if (!Number.isFinite(total) || total <= 0) {
      return Response.json({ error: "Order total is invalid." }, { status: 400 });
    }
    if (!mobile || !address || !street || !area || !city || !state || !pincode) {
      return Response.json(
        { error: "Mobile, address, street, area, city, state, and pincode are required." },
        { status: 400 }
      );
    }
    if (!location?.lat || !location?.lng) {
      return Response.json({ error: "Exact GPS location is required for all payment methods." }, { status: 400 });
    }

    const draftOrder = await createDraftOrder({
      email,
      lineItems: sanitizedItems,
      paymentMethod: "razorpay",
      mobile,
      address,
      street,
      area,
      city,
      state,
      pincode,
      location,
      note: `Razorpay checkout by ${session.email}`,
    });

    const amountInPaise = Math.round(total * 100);
    const razorpayOrder = await createRazorpayOrder({
      keyId: config.razorpayKeyId,
      keySecret: config.razorpayKeySecret,
      amountInPaise,
      receipt: `draft_${draftOrder.id}`,
      notes: {
        Catalog_draft_order_id: String(draftOrder.id),
        customer_email: email,
      },
    });

    return Response.json({
      ok: true,
      keyId: config.razorpayKeyId,
      razorpayOrderId: razorpayOrder.id,
      amount: razorpayOrder.amount,
      currency: razorpayOrder.currency || "INR",
      draftOrderId: draftOrder.id,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to create Razorpay order.";
    return Response.json({ error: message }, { status: 500 });
  }
}



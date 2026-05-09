import crypto from "node:crypto";
import { completeDraftOrderPaid, getDraftOrderSnapshot, markDraftOrderFailed } from "@/lib/catalog";
import { getCatalogCommerceConfig } from "@/lib/catalogCommerce";
import { createShiprocketShipment } from "@/lib/shiprocket";

function sha512(input: string) {
  return crypto.createHash("sha512").update(input).digest("hex");
}

function safe(value: unknown) {
  return String(value || "").trim();
}

async function processPayuReturn(payload: Record<string, unknown>) {
  const config = await getCatalogCommerceConfig();
  const status = safe(payload.status).toLowerCase();
  const key = safe(payload.key);
  const txnid = safe(payload.txnid);
  const amount = safe(payload.amount);
  const productinfo = safe(payload.productinfo);
  const firstname = safe(payload.firstname);
  const email = safe(payload.email).toLowerCase();
  const udf1 = safe(payload.udf1);
  const udf2 = safe(payload.udf2);
  const udf3 = safe(payload.udf3);
  const udf4 = safe(payload.udf4);
  const udf5 = safe(payload.udf5);
  const incomingHash = safe(payload.hash).toLowerCase();
  const draftOrderId = Number(udf1 || 0);
  const base = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

  if (!draftOrderId || !incomingHash) {
    return Response.redirect(`${base}/checkout?paymentStatus=failed`);
  }

  const reverseHashString = `${config.payuSalt}|${status}||||||${udf5}|${udf4}|${udf3}|${udf2}|${udf1}|${email}|${firstname}|${productinfo}|${amount}|${txnid}|${key}`;
  const expectedHash = sha512(reverseHashString).toLowerCase();
  if (expectedHash !== incomingHash) {
    await markDraftOrderFailed(draftOrderId).catch(() => undefined);
    return Response.redirect(`${base}/checkout?paymentStatus=failed`);
  }

  if (status === "success") {
    await completeDraftOrderPaid(draftOrderId, {
      paymentId: txnid || `PAYU-${draftOrderId}`,
      transactionStatus: "paid",
      paymentMethod: "payu",
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
    return Response.redirect(`${base}/user-dashboard?payment=success`);
  }

  await markDraftOrderFailed(draftOrderId).catch(() => undefined);
  return Response.redirect(`${base}/checkout?paymentStatus=failed`);
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const payload: Record<string, unknown> = {};
  url.searchParams.forEach((value, key) => {
    payload[key] = value;
  });
  return processPayuReturn(payload);
}

export async function POST(request: Request) {
  const contentType = request.headers.get("content-type") || "";
  let payload: Record<string, unknown> = {};
  if (contentType.includes("application/json")) {
    payload = (await request.json()) as Record<string, unknown>;
  } else {
    const form = await request.formData();
    form.forEach((value, key) => {
      payload[key] = String(value);
    });
  }
  return processPayuReturn(payload);
}

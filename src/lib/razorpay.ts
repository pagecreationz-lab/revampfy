import "server-only";
import crypto from "node:crypto";

function basicAuth(keyId: string, keySecret: string) {
  return Buffer.from(`${keyId}:${keySecret}`).toString("base64");
}

export async function createRazorpayOrder(input: {
  keyId: string;
  keySecret: string;
  amountInPaise: number;
  receipt: string;
  notes?: Record<string, string>;
}) {
  const res = await fetch("https://api.razorpay.com/v1/orders", {
    method: "POST",
    headers: {
      Authorization: `Basic ${basicAuth(input.keyId, input.keySecret)}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      amount: input.amountInPaise,
      currency: "INR",
      receipt: input.receipt,
      payment_capture: true,
      notes: input.notes || {},
    }),
    cache: "no-store",
  });

  const raw = await res.text();
  let parsed: Record<string, unknown> = {};
  try {
    parsed = raw ? JSON.parse(raw) : {};
  } catch {
    parsed = { raw };
  }
  if (!res.ok) {
    throw new Error(`Razorpay API error (${res.status}): ${JSON.stringify(parsed)}`);
  }
  return parsed as { id: string; amount: number; currency: string; status: string };
}

export function verifyRazorpaySignature(input: {
  orderId: string;
  paymentId: string;
  signature: string;
  keySecret: string;
}): boolean {
  const expected = crypto
    .createHmac("sha256", input.keySecret)
    .update(`${input.orderId}|${input.paymentId}`)
    .digest("hex");
  return expected === input.signature;
}

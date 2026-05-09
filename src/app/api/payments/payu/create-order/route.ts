import crypto from "node:crypto";
import { readSessionFromRequest, verifySessionToken } from "@/lib/auth";
import { createDraftOrder } from "@/lib/catalog";
import { getCatalogCommerceConfig } from "@/lib/catalogCommerce";

type CartLine = { variantId: number; quantity: number };

function sha512(input: string) {
  return crypto.createHash("sha512").update(input).digest("hex");
}

export async function POST(request: Request) {
  const token = readSessionFromRequest(request);
  const session = verifySessionToken(token);
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const config = await getCatalogCommerceConfig();
    if (!config.payuEnabled) return Response.json({ error: "PayU is disabled in CMS." }, { status: 403 });
    if (!config.payuKey || !config.payuSalt) {
      return Response.json({ error: "PayU keys are not configured in CMS." }, { status: 400 });
    }

    const payload = await request.json();
    const email = String(payload?.email || session.email || "").trim().toLowerCase();
    const total = Number(payload?.total || 0);
    const lineItems = Array.isArray(payload?.lineItems) ? (payload.lineItems as CartLine[]) : [];
    const mobile = String(payload?.mobile || "").trim();
    const address = String(payload?.address || "").trim();
    const street = String(payload?.street || "").trim();
    const area = String(payload?.area || "").trim();
    const city = String(payload?.city || "").trim();
    const state = String(payload?.state || "").trim();
    const pincode = String(payload?.pincode || "").trim();
    const location = payload?.location as { lat?: string; lng?: string } | undefined;
    const firstname = String(payload?.name || email.split("@")[0] || "Customer").trim();
    const productinfo = "Revampfy Order";

    const sanitizedItems = lineItems
      .map((line) => ({ variantId: Number(line.variantId), quantity: Math.max(1, Number(line.quantity) || 1) }))
      .filter((line) => Number.isFinite(line.variantId) && line.variantId > 0);

    if (!email) return Response.json({ error: "Email is required." }, { status: 400 });
    if (!sanitizedItems.length) return Response.json({ error: "No valid cart items found." }, { status: 400 });
    if (!Number.isFinite(total) || total <= 0) return Response.json({ error: "Order total is invalid." }, { status: 400 });
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
      paymentMethod: "payu",
      mobile,
      address,
      street,
      area,
      city,
      state,
      pincode,
      location,
      note: `PayU checkout by ${session.email}`,
    });

    const txnid = `payu_${draftOrder.id}_${Date.now()}`;
    const amount = total.toFixed(2);
    const key = config.payuKey;
    const udf1 = String(draftOrder.id);
    const udf2 = "";
    const udf3 = "";
    const udf4 = "";
    const udf5 = "";
    const hashString = `${key}|${txnid}|${amount}|${productinfo}|${firstname}|${email}|${udf1}|${udf2}|${udf3}|${udf4}|${udf5}||||||${config.payuSalt}`;
    const hash = sha512(hashString);
    const base = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
    const surl = `${base}/api/payments/payu/return`;
    const furl = `${base}/api/payments/payu/return`;
    const action = process.env.PAYU_BASE_URL || "https://secure.payu.in/_payment";

    return Response.json({
      ok: true,
      draftOrderId: draftOrder.id,
      paymentForm: {
        action,
        method: "POST",
        fields: {
          key,
          txnid,
          amount,
          productinfo,
          firstname,
          email,
          phone: mobile,
          address1: address,
          udf1,
          udf2,
          udf3,
          udf4,
          udf5,
          surl,
          furl,
          hash,
          service_provider: "payu_paisa",
        },
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to create PayU order.";
    return Response.json({ error: message }, { status: 500 });
  }
}

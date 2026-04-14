import { readSessionFromRequest, verifySessionToken } from "@/lib/auth";
import { getCustomerByEmail, updateCustomerProfile, type PaymentMode } from "@/lib/customerData";
import { upsertCustomerByEmail } from "@/lib/shopify";
import { getShopifyCommerceConfig } from "@/lib/shopifyCommerce";

const PAYMENT_MODES: PaymentMode[] = ["UPI", "Card", "NetBanking", "COD"];

export async function GET(request: Request) {
  const token = readSessionFromRequest(request);
  const session = verifySessionToken(token);
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (session.role !== "customer") {
    return Response.json({ error: "Customer access only" }, { status: 403 });
  }

  const user = await getCustomerByEmail(session.email);
  if (!user) {
    return Response.json({ error: "Customer profile not found." }, { status: 404 });
  }

  return Response.json({
    profile: {
      email: user.email,
      name: user.name,
      mobile: user.mobile,
      address: user.address,
      paymentMode: user.paymentMode,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    },
  });
}

export async function PUT(request: Request) {
  const token = readSessionFromRequest(request);
  const session = verifySessionToken(token);
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.role !== "customer") {
    return Response.json({ error: "Customer access only" }, { status: 403 });
  }

  try {
    const payload = await request.json();
    const paymentMode = String(payload?.paymentMode || "") as PaymentMode;
    const safePaymentMode = PAYMENT_MODES.includes(paymentMode) ? paymentMode : undefined;

    const profile = await updateCustomerProfile(session.email, {
      name: typeof payload?.name === "string" ? payload.name : undefined,
      mobile: typeof payload?.mobile === "string" ? payload.mobile : undefined,
      address: typeof payload?.address === "string" ? payload.address : undefined,
      paymentMode: safePaymentMode,
    });

    const [firstName, ...rest] = (profile.name || "").trim().split(/\s+/).filter(Boolean);
    const lastName = rest.join(" ");
    const commerceConfig = await getShopifyCommerceConfig();
    if (commerceConfig.enableCustomerAccounts && commerceConfig.enableTwoWaySync) {
      void upsertCustomerByEmail({
        email: profile.email,
        firstName: firstName || "Customer",
        lastName,
        phone: profile.mobile || undefined,
        address1: profile.address || undefined,
      }).catch(() => {
        // Profile updates remain available even if Shopify write scope is missing.
      });
    }

    return Response.json({
      ok: true,
      profile: {
        email: profile.email,
        name: profile.name,
        mobile: profile.mobile,
        address: profile.address,
        paymentMode: profile.paymentMode,
        createdAt: profile.createdAt,
        updatedAt: profile.updatedAt,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to update profile.";
    return Response.json({ error: message }, { status: 500 });
  }
}

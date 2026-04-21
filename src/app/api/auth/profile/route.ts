import { createSessionToken, readSessionFromRequest, verifySessionToken } from "@/lib/auth";
import { getCustomerByEmail, updateCustomerProfile, type PaymentMode } from "@/lib/customerData";
import { upsertCustomerByEmail } from "@/lib/shopify";
import { getShopifyCommerceConfig } from "@/lib/shopifyCommerce";

const PAYMENT_MODES: PaymentMode[] = ["UPI", "Card", "NetBanking", "COD"];
const MAX_AGE = 60 * 60 * 12;

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
  const emailMobileMatch = user.email.match(/^mobile(\d{10,15})@pcgs\.local$/i);
  const derivedMobile = emailMobileMatch ? `+${emailMobileMatch[1]}` : "";
  const effectiveMobile = user.mobile || derivedMobile;

  return Response.json({
    profile: {
      email: user.email,
      name: user.name,
      mobile: effectiveMobile,
      address: user.address,
      paymentMode: user.paymentMode,
      requiresProfileCompletion:
        Boolean(user.needsProfileCompletion) || user.email.endsWith("@pcgs.local"),
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
    const requestedEmail =
      typeof payload?.email === "string" ? payload.email.trim().toLowerCase() : undefined;
    const requestedName = typeof payload?.name === "string" ? payload.name.trim() : undefined;
    const needsCompletion =
      requestedEmail && requestedName ? false : undefined;

    const profile = await updateCustomerProfile(session.email, {
      email: requestedEmail,
      name: requestedName,
      mobile: typeof payload?.mobile === "string" ? payload.mobile : undefined,
      address: typeof payload?.address === "string" ? payload.address : undefined,
      paymentMode: safePaymentMode,
      needsProfileCompletion: needsCompletion,
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

    const response = Response.json({
      ok: true,
      profile: {
        email: profile.email,
        name: profile.name,
        mobile: profile.mobile,
        address: profile.address,
        paymentMode: profile.paymentMode,
        requiresProfileCompletion:
          Boolean(profile.needsProfileCompletion) || profile.email.endsWith("@pcgs.local"),
        createdAt: profile.createdAt,
        updatedAt: profile.updatedAt,
      },
    });

    if (profile.email !== session.email) {
      const exp = Date.now() + MAX_AGE * 1000;
      const token = createSessionToken({ email: profile.email, role: "customer", exp });
      response.headers.append(
        "Set-Cookie",
        `pcgs_admin_session=${token}; Path=/; Max-Age=${MAX_AGE}; HttpOnly; SameSite=Lax${
          process.env.NODE_ENV === "production" ? "; Secure" : ""
        }`
      );
    }
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to update profile.";
    return Response.json({ error: message }, { status: 500 });
  }
}

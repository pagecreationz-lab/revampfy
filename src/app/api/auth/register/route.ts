import { NextResponse } from "next/server";
import { createSessionToken } from "@/lib/auth";
import { registerCustomerUser } from "@/lib/customerData";
import { upsertCustomerByEmail } from "@/lib/shopify";
import { getShopifyCommerceConfig } from "@/lib/shopifyCommerce";

const MAX_AGE = 60 * 60 * 12;

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    const email = String(payload?.email || "").trim().toLowerCase();
    const password = String(payload?.password || "");
    const name = String(payload?.name || "").trim();
    const mobile = String(payload?.mobile || "").trim();

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required." },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: "Password must be at least 6 characters." },
        { status: 400 }
      );
    }

    const user = await registerCustomerUser({ email, password, name, mobile });
    const [firstName, ...rest] = (name || "").trim().split(/\s+/).filter(Boolean);
    const lastName = rest.join(" ");
    const commerceConfig = await getShopifyCommerceConfig();
    if (commerceConfig.enableCustomerAccounts && commerceConfig.enableTwoWaySync) {
      void upsertCustomerByEmail({
        email: user.email,
        firstName: firstName || "Customer",
        lastName,
        phone: mobile || undefined,
      }).catch(() => {
        // Do not block portal registration if Shopify customer sync fails.
      });
    }
    const exp = Date.now() + MAX_AGE * 1000;
    const token = createSessionToken({ email: user.email, role: "customer", exp });
    const response = NextResponse.json({
      ok: true,
      user: {
        email: user.email,
        name: user.name,
        mobile: user.mobile,
      },
      exp,
    });

    response.cookies.set("pcgs_admin_session", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: MAX_AGE,
    });

    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Registration failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

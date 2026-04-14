import { NextResponse } from "next/server";
import { createSessionToken, getAdminUsers } from "@/lib/auth";
import { ensureCustomerUserByEmail } from "@/lib/customerData";
import { verifyEmailLoginCode } from "@/lib/emailLoginCodes";
import { getAuthSettings } from "@/lib/authSettings";

const MAX_AGE = 60 * 60 * 12;

export async function POST(request: Request) {
  try {
    const authSettings = await getAuthSettings();
    if (!authSettings.enableEmailCodeLogin) {
      return NextResponse.json({ error: "Email code login is disabled." }, { status: 403 });
    }

    const payload = await request.json();
    const cookie = request.headers.get("cookie") || "";
    const pendingMatch = cookie.match(/pcgs_pending_login_email=([^;]+)/);
    const pendingEmail = decodeURIComponent(pendingMatch?.[1] || "").trim().toLowerCase();
    const email = pendingEmail || String(payload?.email || "").trim().toLowerCase();
    const code = String(payload?.code || "").trim();

    if (!email || !code) {
      return NextResponse.json({ error: "Email and verification code are required." }, { status: 400 });
    }

    const result = await verifyEmailLoginCode(email, code);
    if (!result.ok) {
      return NextResponse.json({ error: result.error || "Verification failed." }, { status: 401 });
    }

    const adminUser = getAdminUsers().find((item) => item.email.toLowerCase() === email);
    const role = adminUser ? "admin" : "customer";

    if (role === "customer") {
      await ensureCustomerUserByEmail(email);
    }

    const exp = Date.now() + MAX_AGE * 1000;
    const token = createSessionToken({ email, role, exp });
    const response = NextResponse.json({ ok: true, exp, role });
    response.cookies.set("pcgs_admin_session", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: MAX_AGE,
    });
    response.cookies.set("pcgs_pending_login_email", "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    });
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Verification failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

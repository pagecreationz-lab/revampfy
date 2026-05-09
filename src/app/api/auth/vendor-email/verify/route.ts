import { NextResponse } from "next/server";
import { createSessionToken, verifyPassword } from "@/lib/auth";
import { verifyEmailLoginCode } from "@/lib/emailLoginCodes";
import { getAuthSettings } from "@/lib/authSettings";
import { getVendorByEmail } from "@/lib/vendorPortal";

const MAX_AGE = 60 * 60 * 12;

export async function POST(request: Request) {
  try {
    const authSettings = await getAuthSettings();
    if (!authSettings.vendorEnableEmailCodeLogin) {
      return NextResponse.json({ error: "Email code login is disabled." }, { status: 403 });
    }

    const payload = await request.json();
    const cookie = request.headers.get("cookie") || "";
    const pendingMatch = cookie.match(/pcgs_pending_vendor_email=([^;]+)/);
    const pendingEmail = decodeURIComponent(pendingMatch?.[1] || "").trim().toLowerCase();
    const email = pendingEmail || String(payload?.email || "").trim().toLowerCase();
    const password = String(payload?.password || "").trim();
    const code = String(payload?.code || "").trim();

    if (!email || !code || !password) {
      return NextResponse.json(
        { error: "Email, password, and verification code are required." },
        { status: 400 }
      );
    }

    const vendor = await getVendorByEmail(email);
    if (!vendor || !vendor.isActive || !vendor.passwordHash) {
      return NextResponse.json({ error: "Vendor account not found." }, { status: 404 });
    }

    if (!verifyPassword(password, vendor.passwordHash)) {
      return NextResponse.json({ error: "Invalid vendor credentials." }, { status: 401 });
    }

    const result = await verifyEmailLoginCode(email, code);
    if (!result.ok) {
      return NextResponse.json({ error: result.error || "Verification failed." }, { status: 401 });
    }

    const exp = Date.now() + MAX_AGE * 1000;
    const token = createSessionToken({ email, role: "vendor", exp });
    const response = NextResponse.json({ ok: true, exp, role: "vendor" });
    response.cookies.set("pcgs_admin_session", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: MAX_AGE,
    });
    response.cookies.set("pcgs_pending_vendor_email", "", {
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

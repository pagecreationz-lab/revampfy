import { NextResponse } from "next/server";
import { authenticateVendor } from "@/lib/vendorPortal";
import { createSessionToken } from "@/lib/auth";
import { getAuthSettings } from "@/lib/authSettings";

const MAX_AGE = 60 * 60 * 12;

export async function POST(request: Request) {
  try {
    const settings = await getAuthSettings();
    if (!settings.vendorEnableEmailPasswordLogin) {
      return NextResponse.json({ error: "Vendor password login is disabled." }, { status: 403 });
    }

    const payload = await request.json();
    const email = String(payload?.email || "").trim().toLowerCase();
    const password = String(payload?.password || "").trim();

    if (!email || !password) {
      return NextResponse.json({ error: "Email and password are required." }, { status: 400 });
    }

    const vendor = await authenticateVendor(email, password);
    if (!vendor) {
      return NextResponse.json({ error: "Invalid vendor credentials." }, { status: 401 });
    }

    const exp = Date.now() + MAX_AGE * 1000;
    const token = createSessionToken({ email: vendor.email, role: "vendor", exp });
    const response = NextResponse.json({ ok: true, role: "vendor", exp, vendor });
    response.cookies.set("pcgs_admin_session", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: MAX_AGE,
    });
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Vendor login failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

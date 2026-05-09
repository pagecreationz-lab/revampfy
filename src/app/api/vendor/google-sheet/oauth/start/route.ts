import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { requireSession } from "@/lib/sessionGuard";
import { getVendorByEmail } from "@/lib/vendorPortal";
import { getAdminIntegrationSettings } from "@/lib/adminIntegrations";

export async function GET(request: Request) {
  const auth = requireSession(request, "vendor");
  if (auth.error) return auth.error;
  const vendor = await getVendorByEmail(auth.session!.email);
  if (!vendor) return NextResponse.json({ error: "Vendor not found." }, { status: 404 });

  const admin = await getAdminIntegrationSettings();
  if (!admin.googleSheets.clientId) {
    return NextResponse.json({ error: "Google OAuth client ID is missing in CMS admin." }, { status: 400 });
  }
  const redirectUri =
    process.env.VENDOR_GOOGLE_REDIRECT_URI ||
    admin.googleSheets.redirectUri ||
    `${new URL(request.url).origin}/api/vendor/google-sheet/oauth/callback`;

  const state = crypto.randomBytes(16).toString("hex");
  const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  authUrl.searchParams.set("client_id", admin.googleSheets.clientId);
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("scope", "openid email profile https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive.metadata.readonly");
  authUrl.searchParams.set("access_type", "offline");
  authUrl.searchParams.set("prompt", "consent");
  authUrl.searchParams.set("state", `${state}:${vendor.id}`);

  const res = NextResponse.redirect(authUrl.toString());
  res.cookies.set("pcgs_vendor_google_oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 10 * 60,
  });
  return res;
}

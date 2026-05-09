import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { requireSession } from "@/lib/sessionGuard";
import { getAdminIntegrationSettings } from "@/lib/adminIntegrations";

export async function GET(request: Request) {
  const auth = requireSession(request, "admin");
  if (auth.error) return auth.error;

  const settings = await getAdminIntegrationSettings();
  if (!settings.googleSheets.clientId) {
    return NextResponse.json(
      { error: "Set Google client ID first in Google Sheet Integration settings." },
      { status: 400 }
    );
  }
  const url = new URL(request.url);
  const redirectUri =
    settings.googleSheets.redirectUri ||
    `${url.origin}/api/admin/integrations/google-sheets/oauth/callback`;

  const state = crypto.randomBytes(16).toString("hex");
  const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  authUrl.searchParams.set("client_id", settings.googleSheets.clientId);
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set(
    "scope",
    "openid email profile https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive"
  );
  authUrl.searchParams.set("access_type", "offline");
  authUrl.searchParams.set("include_granted_scopes", "true");
  authUrl.searchParams.set("prompt", "select_account consent");
  if (settings.googleSheets.connectedEmail) {
    authUrl.searchParams.set("login_hint", settings.googleSheets.connectedEmail);
  }
  authUrl.searchParams.set("state", state);

  const response = NextResponse.redirect(authUrl.toString());
  response.cookies.set("pcgs_google_oauth_state", state, {
    httpOnly: true,
    secure: false,
    sameSite: "lax",
    path: "/",
    maxAge: 10 * 60,
  });
  return response;
}

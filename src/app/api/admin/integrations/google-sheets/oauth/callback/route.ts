import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { saveAdminIntegrationSettings, getAdminIntegrationSettings } from "@/lib/adminIntegrations";

function safeRedirect(requestUrl: string, pathWithQuery: string) {
  const base = new URL(requestUrl);
  return NextResponse.redirect(new URL(pathWithQuery, base.origin));
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const code = String(url.searchParams.get("code") || "").trim();
    const state = String(url.searchParams.get("state") || "").trim();
    const error = String(url.searchParams.get("error") || "").trim();

    const cookieStore = await cookies();
    const stateCookie = String(cookieStore.get("pcgs_google_oauth_state")?.value || "");
    if (error) {
      return safeRedirect(
        request.url,
        `/admin/google-sheet-integration?googleSheetsError=${encodeURIComponent(error)}`
      );
    }
    if (!code || !state || !stateCookie || state !== stateCookie) {
      return safeRedirect(
        request.url,
        "/admin/google-sheet-integration?googleSheetsError=invalid_oauth_state"
      );
    }

    const settings = await getAdminIntegrationSettings();
    if (!settings.googleSheets.clientId || !settings.googleSheets.clientSecret) {
      return safeRedirect(
        request.url,
        "/admin/google-sheet-integration?googleSheetsError=missing_google_settings"
      );
    }
    const redirectUri =
      settings.googleSheets.redirectUri ||
      `${url.origin}/api/admin/integrations/google-sheets/oauth/callback`;

    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: settings.googleSheets.clientId,
        client_secret: settings.googleSheets.clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });
    const tokenJson = (await tokenRes.json()) as {
      access_token?: string;
      refresh_token?: string;
      expires_in?: number;
      scope?: string;
      error?: string;
      error_description?: string;
      id_token?: string;
    };
    if (!tokenRes.ok || !tokenJson.access_token) {
      throw new Error(tokenJson.error_description || tokenJson.error || "Google token exchange failed.");
    }

    let email = "";
    try {
      const profileRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
        headers: { Authorization: `Bearer ${tokenJson.access_token}` },
      });
      const profile = (await profileRes.json()) as { email?: string };
      email = String(profile.email || "");
    } catch {
      email = "";
    }

    let scopeText = String(tokenJson.scope || "").trim();
    if (!scopeText) {
      try {
        const tokenInfoRes = await fetch(
          `https://oauth2.googleapis.com/tokeninfo?access_token=${encodeURIComponent(
            tokenJson.access_token
          )}`,
          { cache: "no-store" }
        );
        const tokenInfoJson = (await tokenInfoRes.json().catch(() => ({}))) as { scope?: string };
        scopeText = String(tokenInfoJson.scope || "").trim();
      } catch {
        scopeText = "";
      }
    }
    const scopeParts = scopeText
      .split(/\s+/)
      .map((part) => part.trim())
      .filter(Boolean);
    const hasDriveScope = scopeParts.includes("https://www.googleapis.com/auth/drive");
    if (!hasDriveScope) {
      throw new Error(
        "Missing Google Drive scope. Click Connect Google again and accept all requested permissions."
      );
    }

    const expiry = Date.now() + Math.max(300, Number(tokenJson.expires_in || 3600)) * 1000;
    await saveAdminIntegrationSettings({
      googleSheets: {
        ...settings.googleSheets,
        enabled: true,
        connectedEmail: email,
        accessToken: tokenJson.access_token,
        refreshToken: tokenJson.refresh_token || settings.googleSheets.refreshToken,
        tokenExpiry: expiry,
      },
    });

    const response = safeRedirect(request.url, "/admin/google-sheet-integration?googleSheets=connected");
    response.cookies.set("pcgs_google_oauth_state", "", { path: "/", maxAge: 0 });
    return response;
  } catch (err) {
    const msg = err instanceof Error ? err.message : "google_oauth_failed";
    try {
      return safeRedirect(
        request.url,
        `/admin/google-sheet-integration?googleSheetsError=${encodeURIComponent(msg)}`
      );
    } catch {
      return NextResponse.json({ error: msg }, { status: 500 });
    }
  }
}

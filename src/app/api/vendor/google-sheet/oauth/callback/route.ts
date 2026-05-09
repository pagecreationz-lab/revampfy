import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getAdminIntegrationSettings } from "@/lib/adminIntegrations";
import { getVendorSheetLink, upsertVendorSheetLink } from "@/lib/vendorSheetLinks";
import { getVendorPortalData } from "@/lib/vendorPortal";
import { syncVendorSheet } from "@/lib/vendorSheetSync";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = String(url.searchParams.get("code") || "").trim();
  const state = String(url.searchParams.get("state") || "").trim();
  const error = String(url.searchParams.get("error") || "").trim();
  if (error) return NextResponse.redirect(`/vendor-admin?sheetOauthError=${encodeURIComponent(error)}`);

  const [stateValue, vendorId] = state.split(":");
  const cookieStore = await cookies();
  const stateCookie = String(cookieStore.get("pcgs_vendor_google_oauth_state")?.value || "");
  if (!code || !vendorId || !stateValue || !stateCookie || stateValue !== stateCookie) {
    return NextResponse.redirect("/vendor-admin?sheetOauthError=invalid_state");
  }

  const admin = await getAdminIntegrationSettings();
  if (!admin.googleSheets.clientId || !admin.googleSheets.clientSecret) {
    return NextResponse.redirect("/vendor-admin?sheetOauthError=missing_admin_google_credentials");
  }
  const redirectUri =
    process.env.VENDOR_GOOGLE_REDIRECT_URI ||
    admin.googleSheets.redirectUri ||
    `${url.origin}/api/vendor/google-sheet/oauth/callback`;
  try {
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: admin.googleSheets.clientId,
        client_secret: admin.googleSheets.clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });
    const tokenJson = (await tokenRes.json()) as {
      access_token?: string;
      refresh_token?: string;
      expires_in?: number;
      error?: string;
      error_description?: string;
    };
    if (!tokenRes.ok || !tokenJson.access_token) {
      throw new Error(tokenJson.error_description || tokenJson.error || "OAuth token exchange failed.");
    }

    const portal = await getVendorPortalData();
    const vendor = portal.vendors.find((entry) => entry.id === vendorId);
    if (!vendor) throw new Error("Vendor not found for OAuth.");

    const existing = await getVendorSheetLink(vendorId, true);
    if (!existing?.sheetId) {
      throw new Error("No Google Sheet assigned to this vendor account.");
    }

    let googleEmail = "";
    let googleUserId = "";
    try {
      const profileRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
        headers: { Authorization: `Bearer ${tokenJson.access_token}` },
        cache: "no-store",
      });
      const profile = (await profileRes.json()) as { email?: string; id?: string };
      googleEmail = String(profile.email || "").trim().toLowerCase();
      googleUserId = String(profile.id || "").trim();
    } catch {
      googleEmail = "";
      googleUserId = "";
    }
    if (!googleEmail) throw new Error("Unable to read Google account email.");
    const allowed = new Set<string>(
      [vendor.email, ...(existing?.allowedGoogleEmails || [])].map((v) => String(v || "").trim().toLowerCase())
    );
    if (!allowed.has(googleEmail)) {
      throw new Error("No Google Sheet assigned to this vendor account.");
    }

    const selectedSheetId = String(existing?.sheetId || "").trim();
    const selectedSheetUrl = String(existing?.sheetUrl || "").trim();
    const selectedSheetName = String(existing?.sheetName || "Sheet1").trim() || "Sheet1";

    await upsertVendorSheetLink({
      vendorId,
      vendorEmail: vendor.email,
      googleLoginEmail: googleEmail,
      googleUserId,
      lastGoogleLoginAt: new Date().toISOString(),
      enabled: true,
      accessToken: tokenJson.access_token,
      refreshToken: tokenJson.refresh_token || String(existing?.refreshToken || ""),
      tokenExpiry: Date.now() + Math.max(300, Number(tokenJson.expires_in || 3600)) * 1000,
      sheetId: selectedSheetId,
      sheetUrl: selectedSheetUrl,
      sheetName: selectedSheetName,
      syncStatus: "inactive",
      lastSyncMessage: "Google connected. Syncing...",
    });

    try {
      await syncVendorSheet(vendorId);
    } catch (syncError) {
      await upsertVendorSheetLink({
        vendorId,
        vendorEmail: vendor.email,
        syncStatus: "failed",
        lastSyncedAt: new Date().toISOString(),
        lastSyncMessage:
          syncError instanceof Error
            ? `Google connected, but auto-sync failed: ${syncError.message}`
            : "Google connected, but auto-sync failed.",
      });
    }
    const res = NextResponse.redirect("/vendor-admin?sheetOauth=connected");
    res.cookies.set("pcgs_vendor_google_oauth_state", "", { path: "/", maxAge: 0 });
    return res;
  } catch (err) {
    const message = err instanceof Error ? err.message : "oauth_failed";
    return NextResponse.redirect(`/vendor-admin?sheetOauthError=${encodeURIComponent(message)}`);
  }
}

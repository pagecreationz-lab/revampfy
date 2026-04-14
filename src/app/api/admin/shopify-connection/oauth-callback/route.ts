import { NextResponse } from "next/server";
import { consumeOAuthState } from "@/lib/shopifyOAuth";
import { saveShopifyConnectionSettings } from "@/lib/shopifyConnection";

function redirectWithError(requestUrl: string, message: string) {
  const redirectUrl = new URL("/admin", requestUrl);
  redirectUrl.searchParams.set("oauth", "error");
  redirectUrl.searchParams.set("message", message);
  return NextResponse.redirect(redirectUrl);
}

export async function GET(request: Request) {
  const requestUrl = request.url;
  const url = new URL(requestUrl);
  const code = url.searchParams.get("code") || "";
  const state = url.searchParams.get("state") || "";
  const shop = url.searchParams.get("shop") || "";

  if (!code || !state || !shop) {
    return redirectWithError(requestUrl, "Missing OAuth callback params.");
  }

  const stateRecord = await consumeOAuthState(state);
  if (!stateRecord) {
    return redirectWithError(requestUrl, "Invalid or expired OAuth state. Try again.");
  }

  const normalizedShop = shop.trim().toLowerCase();
  const normalizedStoredDomain = stateRecord.storeDomain.trim().toLowerCase();
  if (normalizedShop !== normalizedStoredDomain) {
    return redirectWithError(
      requestUrl,
      "Shop domain mismatch in callback. Start OAuth again."
    );
  }

  const clientId = process.env.SHOPIFY_APP_CLIENT_ID || "";
  const clientSecret = process.env.SHOPIFY_APP_CLIENT_SECRET || "";

  if (!clientId || !clientSecret) {
    return redirectWithError(
      requestUrl,
      "Server missing SHOPIFY_APP_CLIENT_ID / SHOPIFY_APP_CLIENT_SECRET."
    );
  }

  const tokenUrl = `https://${normalizedShop}/admin/oauth/access_token`;

  try {
    const tokenResponse = await fetch(tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code,
      }),
      cache: "no-store",
    });

    const raw = await tokenResponse.text();
    let tokenJson: Record<string, unknown> = {};
    if (raw) {
      try {
        tokenJson = JSON.parse(raw) as Record<string, unknown>;
      } catch {
        tokenJson = {};
      }
    }

    if (!tokenResponse.ok || !tokenJson.access_token) {
      return redirectWithError(
        requestUrl,
        `Token exchange failed (${tokenResponse.status}). Verify App URL, redirect URL, and app installation.`
      );
    }

    await saveShopifyConnectionSettings({
      mode: "oauth",
      storeDomain: normalizedShop,
      apiVersion: stateRecord.apiVersion || "2024-10",
      accessToken: String(tokenJson.access_token),
      clientId: "",
      clientSecret: "",
    });

    const redirectUrl = new URL("/admin", requestUrl);
    redirectUrl.searchParams.set("oauth", "success");
    return NextResponse.redirect(redirectUrl);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "OAuth callback failed unexpectedly.";
    return redirectWithError(requestUrl, message);
  }
}


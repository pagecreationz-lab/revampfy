import { NextResponse } from "next/server";
import {
  getShopifyConnectionSettings,
  maskAccessToken,
  maskSecret,
  saveShopifyConnectionSettings,
  type ShopifyConnectionMode,
  type ShopifyConnectionSettings,
} from "@/lib/shopifyConnection";

type ProbeResult = {
  ok: boolean;
  shopName?: string;
  grantedScopes?: string[];
  missingRequiredScopes?: string[];
  scopeError?: string;
  error?: string;
  resolvedAccessToken?: string;
};

function connectionHint(errorText: string): string {
  const text = errorText.toLowerCase();
  if (text.includes("token exchange failed (400)")) {
    return "This app likely does not support client_credentials for this store. Try Admin API token mode, or use a Dev Dashboard app configured for client credentials.";
  }
  if (text.includes("application_cannot_be_found")) {
    return "OAuth app not found for this store. Confirm Client ID belongs to an app installed on the same myshopify store and callback URL is configured.";
  }
  if (text.includes("invalid api key or access token") || text.includes("(401)")) {
    return "Use Admin API access token or correct Client ID/Secret for this store. Reinstall app after scope changes.";
  }
  if (text.includes("not found") || text.includes("(404)")) {
    return "Check store domain format: yourstore.myshopify.com (no https, no trailing slash).";
  }
  if (text.includes("forbidden") || text.includes("(403)")) {
    return "Credentials are valid but scopes are missing. Add read_products, read_content, read_metaobjects, write_draft_orders, read_customers, write_customers and reinstall/reconnect the app.";
  }
  return "Verify mode, domain, API version, credentials, and app scopes.";
}

async function getAccessTokenForSettings(settings: ShopifyConnectionSettings): Promise<string> {
  if (settings.mode === "admin_token") {
    if (!settings.accessToken) {
      throw new Error("Missing Admin API access token.");
    }
    return settings.accessToken;
  }

  if (settings.mode === "oauth") {
    if (!settings.accessToken) {
      throw new Error("Missing OAuth access token. Please reconnect Shopify.");
    }
    return settings.accessToken;
  }

  if (!settings.clientId || !settings.clientSecret) {
    throw new Error("Missing Client ID or Client Secret.");
  }

  const url = `https://${settings.storeDomain}/admin/oauth/access_token`;
  const payloads = [
    new URLSearchParams({
      client_id: settings.clientId,
      client_secret: settings.clientSecret,
      grant_type: "client_credentials",
    }),
    new URLSearchParams({
      app_client_id: settings.clientId,
      app_client_secret: settings.clientSecret,
      grant_type: "client_credentials",
    }),
  ];

  let lastError = "Token exchange failed.";

  for (const body of payloads) {
    const tokenResponse = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
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

    if (tokenResponse.ok && tokenJson?.access_token) {
      return tokenJson.access_token as string;
    }

    lastError = `Token exchange failed (${tokenResponse.status}): ${raw || JSON.stringify(tokenJson)}`;
  }

  throw new Error(lastError);
}

async function testConnection(settings: ShopifyConnectionSettings): Promise<ProbeResult> {
  try {
    const accessToken = await getAccessTokenForSettings(settings);
    const url = `https://${settings.storeDomain}/admin/api/${settings.apiVersion}/shop.json`;

    const response = await fetch(url, {
      headers: {
        "X-Shopify-Access-Token": accessToken,
        "Content-Type": "application/json",
      },
      cache: "no-store",
    });

    if (!response.ok) {
      const message = await response.text();
      return { ok: false, error: `Shopify API error (${response.status}): ${message}` };
    }

    const json = await response.json();
    let grantedScopes: string[] = [];
    let scopeError = "";

    try {
      const scopesUrl = `https://${settings.storeDomain}/admin/oauth/access_scopes.json`;
      const scopesRes = await fetch(scopesUrl, {
        headers: {
          "X-Shopify-Access-Token": accessToken,
          "Content-Type": "application/json",
        },
        cache: "no-store",
      });

      if (scopesRes.ok) {
        const scopesJson = await scopesRes.json();
        grantedScopes = Array.isArray(scopesJson?.access_scopes)
          ? scopesJson.access_scopes
              .map((item: { handle?: string }) => item?.handle || "")
              .filter(Boolean)
          : [];
        const requiredScopes = [
          "read_products",
          "read_content",
          "read_metaobjects",
          "write_draft_orders",
          "read_customers",
          "write_customers",
        ];
        const missingRequiredScopes = requiredScopes.filter(
          (scope) => !grantedScopes.includes(scope)
        );
        if (missingRequiredScopes.length > 0) {
          scopeError = `Missing required scopes: ${missingRequiredScopes.join(
            ", "
          )}. Reconnect Shopify and approve updated permissions.`;
          return {
            ok: true,
            shopName: json?.shop?.name || "Connected",
            resolvedAccessToken: accessToken,
            grantedScopes,
            missingRequiredScopes,
            scopeError,
          };
        }
      } else {
        scopeError = `Unable to read granted scopes (${scopesRes.status}).`;
      }
    } catch {
      scopeError = "Unable to read granted scopes.";
    }

    return {
      ok: true,
      shopName: json?.shop?.name || "Connected",
      resolvedAccessToken: accessToken,
      grantedScopes,
      missingRequiredScopes: [],
      scopeError,
    };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
}

export async function GET() {
  const settings = await getShopifyConnectionSettings();
  if (!settings) {
    return NextResponse.json({ connected: false });
  }

  const probe = await testConnection(settings);
  return NextResponse.json({
    connected: probe.ok,
    shopName: probe.shopName || "",
    settings: {
      mode: settings.mode,
      storeDomain: settings.storeDomain,
      apiVersion: settings.apiVersion,
      maskedAccessToken: settings.accessToken ? maskAccessToken(settings.accessToken) : "",
      clientId: settings.clientId || "",
      maskedClientSecret: settings.clientSecret ? maskSecret(settings.clientSecret) : "",
    },
    error: probe.error || "",
    grantedScopes: probe.grantedScopes || [],
    missingRequiredScopes: probe.missingRequiredScopes || [],
    scopeError: probe.scopeError || "",
    hint: probe.error ? connectionHint(probe.error) : "",
  });
}

export async function POST(request: Request) {
  const payload = await request.json();

  const incomingMode = String(payload.mode || "").trim();
  const mode: ShopifyConnectionMode =
    incomingMode === "client_credentials"
      ? "client_credentials"
      : incomingMode === "oauth"
        ? "oauth"
        : "admin_token";

  const settings: ShopifyConnectionSettings = {
    mode,
    storeDomain: String(payload.storeDomain || "").trim(),
    apiVersion: String(payload.apiVersion || "2024-10").trim(),
    accessToken:
      mode === "admin_token" || mode === "oauth"
        ? String(payload.accessToken || "").trim()
        : "",
    clientId: mode === "client_credentials" ? String(payload.clientId || "").trim() : "",
    clientSecret:
      mode === "client_credentials" ? String(payload.clientSecret || "").trim() : "",
  };

  if (!settings.storeDomain) {
    return NextResponse.json({ error: "storeDomain is required." }, { status: 400 });
  }

  if (settings.storeDomain.includes("http://") || settings.storeDomain.includes("https://")) {
    return NextResponse.json(
      { error: "Use store domain only. Example: yourstore.myshopify.com" },
      { status: 400 }
    );
  }

  if (mode === "admin_token" && !settings.accessToken) {
    return NextResponse.json({ error: "Admin API access token is required." }, { status: 400 });
  }

  if (mode === "client_credentials" && (!settings.clientId || !settings.clientSecret)) {
    return NextResponse.json(
      { error: "Client ID and Client Secret are required." },
      { status: 400 }
    );
  }

  if (mode === "oauth" && !settings.accessToken) {
    return NextResponse.json(
      { error: "OAuth access token is required. Use Connect Shopify button." },
      { status: 400 }
    );
  }

  const probe = await testConnection(settings);
  if (!probe.ok) {
    return NextResponse.json(
      {
        error: probe.error || "Unable to connect to Shopify.",
        hint: connectionHint(probe.error || ""),
      },
      { status: 400 }
    );
  }

  await saveShopifyConnectionSettings(settings);

  return NextResponse.json({
    connected: true,
    shopName: probe.shopName || "",
    grantedScopes: probe.grantedScopes || [],
    missingRequiredScopes: probe.missingRequiredScopes || [],
    scopeError: probe.scopeError || "",
    settings: {
      mode: settings.mode,
      storeDomain: settings.storeDomain,
      apiVersion: settings.apiVersion,
      maskedAccessToken: settings.accessToken ? maskAccessToken(settings.accessToken) : "",
      clientId: settings.clientId || "",
      maskedClientSecret: settings.clientSecret ? maskSecret(settings.clientSecret) : "",
    },
  });
}

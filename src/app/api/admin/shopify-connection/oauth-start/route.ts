import { NextResponse } from "next/server";
import { createOAuthState } from "@/lib/shopifyOAuth";

const DEFAULT_SCOPES = [
  "read_products",
  "write_products",
  "read_content",
  "write_content",
  "read_metaobjects",
  "read_inventory",
  "read_orders",
  "read_customers",
  "write_customers",
  "read_draft_orders",
  "write_draft_orders",
].join(",");

export async function POST(request: Request) {
  const payload = await request.json();
  const storeDomain = String(payload.storeDomain || "")
    .trim()
    .toLowerCase()
    .replace(/\/+$/, "");
  const apiVersion = String(payload.apiVersion || "2024-10").trim();

  if (!storeDomain || storeDomain.includes("http://") || storeDomain.includes("https://")) {
    return NextResponse.json(
      { error: "Use store domain like yourstore.myshopify.com" },
      { status: 400 }
    );
  }

  const clientId = process.env.SHOPIFY_APP_CLIENT_ID || "";
  if (!clientId) {
    return NextResponse.json(
      { error: "SHOPIFY_APP_CLIENT_ID is not configured on server." },
      { status: 500 }
    );
  }

  const state = await createOAuthState(storeDomain, apiVersion);
  const origin = new URL(request.url).origin;
  const appBaseUrl = (process.env.SHOPIFY_APP_BASE_URL || origin).trim().replace(/\/+$/, "");
  const redirectUri = `${appBaseUrl}/api/admin/shopify-connection/oauth-callback`;

  const params = new URLSearchParams({
    client_id: clientId,
    scope: DEFAULT_SCOPES,
    redirect_uri: redirectUri,
    state,
  });

  const authUrl = `https://${storeDomain}/admin/oauth/authorize?${params.toString()}`;
  return NextResponse.json({ authUrl });
}

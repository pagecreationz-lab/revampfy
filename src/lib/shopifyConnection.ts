import "server-only";
import fs from "fs/promises";
import path from "path";

export type ShopifyConnectionMode = "admin_token" | "client_credentials" | "oauth";

export type ShopifyConnectionSettings = {
  mode: ShopifyConnectionMode;
  storeDomain: string;
  apiVersion: string;
  accessToken?: string;
  clientId?: string;
  clientSecret?: string;
};

export type ResolvedShopifyConnection = {
  storeDomain: string;
  accessToken: string;
  apiVersion: string;
};

const DEFAULT_VERSION = "2024-10";
const settingsPath = path.join(process.cwd(), "data", "shopify-connection.json");

export async function getShopifyConnectionSettings(): Promise<ShopifyConnectionSettings | null> {
  try {
    const raw = await fs.readFile(settingsPath, "utf8");
    const parsed = JSON.parse(raw) as Partial<ShopifyConnectionSettings>;
    if (!parsed.storeDomain) return null;

    return {
      mode: (parsed.mode as ShopifyConnectionMode) || "admin_token",
      storeDomain: parsed.storeDomain,
      apiVersion: parsed.apiVersion || DEFAULT_VERSION,
      accessToken: parsed.accessToken || "",
      clientId: parsed.clientId || "",
      clientSecret: parsed.clientSecret || "",
    };
  } catch {
    return null;
  }
}

export async function saveShopifyConnectionSettings(
  settings: ShopifyConnectionSettings
): Promise<void> {
  await fs.mkdir(path.dirname(settingsPath), { recursive: true });
  await fs.writeFile(settingsPath, JSON.stringify(settings, null, 2), "utf8");
}

async function exchangeClientCredentialsToken(
  storeDomain: string,
  clientId: string,
  clientSecret: string
): Promise<string> {
  const url = `https://${storeDomain}/admin/oauth/access_token`;
  const payloads = [
    new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "client_credentials",
    }),
    new URLSearchParams({
      app_client_id: clientId,
      app_client_secret: clientSecret,
      grant_type: "client_credentials",
    }),
  ];

  let lastError = "Token exchange failed with unknown response.";

  for (const body of payloads) {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
      cache: "no-store",
    });

    const raw = await response.text();
    let json: Record<string, unknown> = {};
    if (raw) {
      try {
        json = JSON.parse(raw) as Record<string, unknown>;
      } catch {
        json = {};
      }
    }

    if (response.ok && json?.access_token) {
      return json.access_token as string;
    }

    lastError = `Token exchange failed (${response.status}): ${raw || JSON.stringify(json)}`;
  }

  throw new Error(lastError);
}

export async function resolveShopifyConnectionSettings(): Promise<ResolvedShopifyConnection> {
  const saved = await getShopifyConnectionSettings();

  if (saved) {
    if (saved.mode === "admin_token") {
      if (!saved.accessToken) {
        throw new Error("Missing Admin API access token in Shopify connection settings.");
      }
      return {
        storeDomain: saved.storeDomain,
        accessToken: saved.accessToken,
        apiVersion: saved.apiVersion,
      };
    }

    if (saved.mode === "oauth") {
      if (!saved.accessToken) {
        throw new Error("Missing OAuth access token. Reconnect Shopify.");
      }
      return {
        storeDomain: saved.storeDomain,
        accessToken: saved.accessToken,
        apiVersion: saved.apiVersion,
      };
    }

    if (!saved.clientId || !saved.clientSecret) {
      throw new Error("Missing clientId/clientSecret for client credentials mode.");
    }

    const token = await exchangeClientCredentialsToken(
      saved.storeDomain,
      saved.clientId,
      saved.clientSecret
    );

    return {
      storeDomain: saved.storeDomain,
      accessToken: token,
      apiVersion: saved.apiVersion,
    };
  }

  const storeDomain = process.env.SHOPIFY_STORE_DOMAIN;
  const accessToken = process.env.SHOPIFY_ADMIN_ACCESS_TOKEN;
  const apiVersion = process.env.SHOPIFY_API_VERSION || DEFAULT_VERSION;

  if (!storeDomain || !accessToken) {
    throw new Error(
      "Shopify is not connected. Add credentials in CMS Admin > Shopify Sync."
    );
  }

  return { storeDomain, accessToken, apiVersion };
}

export function maskAccessToken(token?: string): string {
  if (!token) return "";
  if (token.length <= 8) return "********";
  return `${token.slice(0, 4)}...${token.slice(-4)}`;
}

export function maskSecret(secret?: string): string {
  if (!secret) return "";
  if (secret.length <= 8) return "********";
  return `${secret.slice(0, 3)}...${secret.slice(-3)}`;
}

import "server-only";
import fs from "fs/promises";
import path from "path";
import { decryptConfigValue, encryptConfigValue } from "@/lib/secureConfig";

export type N8nIntegrationSettings = {
  enabled: boolean;
  baseUrl: string;
  apiKey: string;
  webhookUrl: string;
};

export type GoogleSheetsIntegrationSettings = {
  enabled: boolean;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  sheetUrl: string;
  spreadsheetId: string;
  sheetName: string;
  connectedEmail: string;
  refreshToken: string;
  accessToken: string;
  tokenExpiry: number;
  autoSyncEnabled: boolean;
  syncIntervalMinutes: number;
  webhookSecret: string;
  lastSyncAt: string;
  lastSyncStatus: "idle" | "success" | "error";
  lastSyncMessage: string;
};

export type AdminIntegrationSettings = {
  n8n: N8nIntegrationSettings;
  googleSheets: GoogleSheetsIntegrationSettings;
  updatedAt: string;
};

const settingsPath = path.join(process.cwd(), "data", "admin-integrations.json");
const logsPath = path.join(process.cwd(), "data", "google-sheets-sync-logs.json");

const defaults: AdminIntegrationSettings = {
  n8n: {
    enabled: false,
    baseUrl: "",
    apiKey: "",
    webhookUrl: "",
  },
  googleSheets: {
    enabled: false,
    clientId: "",
    clientSecret: "",
    redirectUri: "",
    sheetUrl: "",
    spreadsheetId: "",
    sheetName: "Sheet1",
    connectedEmail: "",
    refreshToken: "",
    accessToken: "",
    tokenExpiry: 0,
    autoSyncEnabled: false,
    syncIntervalMinutes: 5,
    webhookSecret: "",
    lastSyncAt: "",
    lastSyncStatus: "idle",
    lastSyncMessage: "",
  },
  updatedAt: new Date(0).toISOString(),
};

export type GoogleSheetsSyncLog = {
  id: string;
  at: string;
  status: "success" | "error";
  message: string;
  vendorsProcessed: number;
  productsProcessed: number;
};

function extractSpreadsheetIdFromUrl(urlOrId: string): string {
  const raw = String(urlOrId || "").trim();
  if (!raw) return "";
  if (!raw.includes("http")) return raw;
  const match = raw.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  return match?.[1] || "";
}

function withFallbackSecret(input: string, previous: string) {
  const value = String(input || "").trim();
  if (!value) return "";
  if (value === "********") return previous;
  return value;
}

export async function getAdminIntegrationSettings(): Promise<AdminIntegrationSettings> {
  try {
    const raw = await fs.readFile(settingsPath, "utf8");
    const parsed = JSON.parse(raw) as Partial<AdminIntegrationSettings>;
    return {
      n8n: {
        enabled: Boolean(parsed?.n8n?.enabled),
        baseUrl: String(parsed?.n8n?.baseUrl || "").trim(),
        apiKey: decryptConfigValue(String(parsed?.n8n?.apiKey || "")),
        webhookUrl: String(parsed?.n8n?.webhookUrl || "").trim(),
      },
      googleSheets: {
        enabled: Boolean(parsed?.googleSheets?.enabled),
        clientId: String(parsed?.googleSheets?.clientId || "").trim(),
        clientSecret: decryptConfigValue(String(parsed?.googleSheets?.clientSecret || "")),
        redirectUri: String(parsed?.googleSheets?.redirectUri || "").trim(),
        sheetUrl: String(parsed?.googleSheets?.sheetUrl || "").trim(),
        spreadsheetId:
          String(parsed?.googleSheets?.spreadsheetId || "").trim() ||
          extractSpreadsheetIdFromUrl(String(parsed?.googleSheets?.sheetUrl || "").trim()),
        sheetName: String(parsed?.googleSheets?.sheetName || "Sheet1").trim() || "Sheet1",
        connectedEmail: String(parsed?.googleSheets?.connectedEmail || "").trim(),
        refreshToken: decryptConfigValue(String(parsed?.googleSheets?.refreshToken || "")),
        accessToken: decryptConfigValue(String(parsed?.googleSheets?.accessToken || "")),
        tokenExpiry: Number(parsed?.googleSheets?.tokenExpiry || 0),
        autoSyncEnabled: Boolean(parsed?.googleSheets?.autoSyncEnabled),
        syncIntervalMinutes: Math.min(
          60,
          Math.max(1, Number(parsed?.googleSheets?.syncIntervalMinutes || 5))
        ),
        webhookSecret: decryptConfigValue(String(parsed?.googleSheets?.webhookSecret || "")),
        lastSyncAt: String(parsed?.googleSheets?.lastSyncAt || ""),
        lastSyncStatus:
          parsed?.googleSheets?.lastSyncStatus === "success" ||
          parsed?.googleSheets?.lastSyncStatus === "error"
            ? parsed.googleSheets.lastSyncStatus
            : "idle",
        lastSyncMessage: String(parsed?.googleSheets?.lastSyncMessage || ""),
      },
      updatedAt: String(parsed?.updatedAt || new Date().toISOString()),
    };
  } catch {
    return defaults;
  }
}

export function toAdminIntegrationPublicView(input: AdminIntegrationSettings) {
  return {
    ...input,
    n8n: {
      ...input.n8n,
      apiKey: input.n8n.apiKey ? "********" : "",
    },
    googleSheets: {
      ...input.googleSheets,
      clientSecret: input.googleSheets.clientSecret ? "********" : "",
      refreshToken: input.googleSheets.refreshToken ? "********" : "",
      accessToken: input.googleSheets.accessToken ? "********" : "",
      webhookSecret: input.googleSheets.webhookSecret ? "********" : "",
    },
  };
}

export async function saveAdminIntegrationSettings(
  partial: Partial<AdminIntegrationSettings>
): Promise<AdminIntegrationSettings> {
  const current = await getAdminIntegrationSettings();
  const next: AdminIntegrationSettings = {
    n8n: {
      enabled: typeof partial.n8n?.enabled === "boolean" ? partial.n8n.enabled : current.n8n.enabled,
      baseUrl:
        typeof partial.n8n?.baseUrl === "string" ? partial.n8n.baseUrl.trim() : current.n8n.baseUrl,
      apiKey: withFallbackSecret(String(partial.n8n?.apiKey || ""), current.n8n.apiKey),
      webhookUrl:
        typeof partial.n8n?.webhookUrl === "string"
          ? partial.n8n.webhookUrl.trim()
          : current.n8n.webhookUrl,
    },
    googleSheets: {
      enabled:
        typeof partial.googleSheets?.enabled === "boolean"
          ? partial.googleSheets.enabled
          : current.googleSheets.enabled,
      clientId:
        typeof partial.googleSheets?.clientId === "string"
          ? partial.googleSheets.clientId.trim()
          : current.googleSheets.clientId,
      clientSecret: withFallbackSecret(
        String(partial.googleSheets?.clientSecret || ""),
        current.googleSheets.clientSecret
      ),
      redirectUri:
        typeof partial.googleSheets?.redirectUri === "string"
          ? partial.googleSheets.redirectUri.trim()
          : current.googleSheets.redirectUri,
      sheetUrl:
        typeof partial.googleSheets?.sheetUrl === "string"
          ? partial.googleSheets.sheetUrl.trim()
          : current.googleSheets.sheetUrl,
      spreadsheetId:
        (() => {
          const direct =
            typeof partial.googleSheets?.spreadsheetId === "string"
              ? partial.googleSheets.spreadsheetId.trim()
              : current.googleSheets.spreadsheetId;
          const fromUrl = extractSpreadsheetIdFromUrl(
            typeof partial.googleSheets?.sheetUrl === "string"
              ? partial.googleSheets.sheetUrl
              : current.googleSheets.sheetUrl
          );
          return direct || fromUrl;
        })(),
      sheetName:
        typeof partial.googleSheets?.sheetName === "string"
          ? partial.googleSheets.sheetName.trim() || "Sheet1"
          : current.googleSheets.sheetName,
      connectedEmail:
        typeof partial.googleSheets?.connectedEmail === "string"
          ? partial.googleSheets.connectedEmail.trim()
          : current.googleSheets.connectedEmail,
      refreshToken: withFallbackSecret(
        String(partial.googleSheets?.refreshToken || ""),
        current.googleSheets.refreshToken
      ),
      accessToken: withFallbackSecret(
        String(partial.googleSheets?.accessToken || ""),
        current.googleSheets.accessToken
      ),
      tokenExpiry: Number.isFinite(Number(partial.googleSheets?.tokenExpiry))
        ? Number(partial.googleSheets?.tokenExpiry)
        : current.googleSheets.tokenExpiry,
      autoSyncEnabled:
        typeof partial.googleSheets?.autoSyncEnabled === "boolean"
          ? partial.googleSheets.autoSyncEnabled
          : current.googleSheets.autoSyncEnabled,
      syncIntervalMinutes: Number.isFinite(Number(partial.googleSheets?.syncIntervalMinutes))
        ? Math.min(60, Math.max(1, Number(partial.googleSheets?.syncIntervalMinutes)))
        : current.googleSheets.syncIntervalMinutes,
      webhookSecret: withFallbackSecret(
        String(partial.googleSheets?.webhookSecret || ""),
        current.googleSheets.webhookSecret
      ),
      lastSyncAt:
        typeof partial.googleSheets?.lastSyncAt === "string"
          ? partial.googleSheets.lastSyncAt
          : current.googleSheets.lastSyncAt,
      lastSyncStatus:
        partial.googleSheets?.lastSyncStatus === "success" ||
        partial.googleSheets?.lastSyncStatus === "error" ||
        partial.googleSheets?.lastSyncStatus === "idle"
          ? partial.googleSheets.lastSyncStatus
          : current.googleSheets.lastSyncStatus,
      lastSyncMessage:
        typeof partial.googleSheets?.lastSyncMessage === "string"
          ? partial.googleSheets.lastSyncMessage
          : current.googleSheets.lastSyncMessage,
    },
    updatedAt: new Date().toISOString(),
  };

  const persisted = {
    ...next,
    n8n: {
      ...next.n8n,
      apiKey: next.n8n.apiKey ? encryptConfigValue(next.n8n.apiKey) : "",
    },
    googleSheets: {
      ...next.googleSheets,
      clientSecret: next.googleSheets.clientSecret
        ? encryptConfigValue(next.googleSheets.clientSecret)
        : "",
      refreshToken: next.googleSheets.refreshToken
        ? encryptConfigValue(next.googleSheets.refreshToken)
        : "",
      accessToken: next.googleSheets.accessToken
        ? encryptConfigValue(next.googleSheets.accessToken)
        : "",
      webhookSecret: next.googleSheets.webhookSecret
        ? encryptConfigValue(next.googleSheets.webhookSecret)
        : "",
    },
  };

  await fs.mkdir(path.dirname(settingsPath), { recursive: true });
  await fs.writeFile(settingsPath, JSON.stringify(persisted, null, 2), "utf8");
  return next;
}

export async function appendGoogleSheetsSyncLog(input: Omit<GoogleSheetsSyncLog, "id" | "at">) {
  const current = await getGoogleSheetsSyncLogs();
  const next: GoogleSheetsSyncLog = {
    id: `sync_${Math.random().toString(36).slice(2, 10)}`,
    at: new Date().toISOString(),
    ...input,
  };
  const merged = [next, ...current].slice(0, 200);
  await fs.mkdir(path.dirname(logsPath), { recursive: true });
  await fs.writeFile(logsPath, JSON.stringify(merged, null, 2), "utf8");
}

export async function getGoogleSheetsSyncLogs(): Promise<GoogleSheetsSyncLog[]> {
  try {
    const raw = await fs.readFile(logsPath, "utf8");
    const parsed = JSON.parse(raw) as GoogleSheetsSyncLog[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function getGoogleSheetsAccessToken() {
  const settings = await getAdminIntegrationSettings();
  if (!settings.googleSheets.clientId || !settings.googleSheets.clientSecret) {
    throw new Error("Google OAuth client ID/secret are not configured.");
  }
  if (!settings.googleSheets.refreshToken) {
    throw new Error("Google Sheets is not connected. Complete OAuth sign-in first.");
  }
  const now = Date.now();
  if (settings.googleSheets.accessToken && settings.googleSheets.tokenExpiry - 60_000 > now) {
    return settings.googleSheets.accessToken;
  }

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: settings.googleSheets.clientId,
      client_secret: settings.googleSheets.clientSecret,
      refresh_token: settings.googleSheets.refreshToken,
      grant_type: "refresh_token",
    }),
  });
  const tokenJson = (await tokenRes.json()) as {
    access_token?: string;
    expires_in?: number;
    error?: string;
    error_description?: string;
  };
  if (!tokenRes.ok || !tokenJson.access_token) {
    throw new Error(
      tokenJson.error_description || tokenJson.error || "Failed to refresh Google access token."
    );
  }

  const expiry = Date.now() + Math.max(300, Number(tokenJson.expires_in || 3600)) * 1000;
  await saveAdminIntegrationSettings({
    googleSheets: {
      ...settings.googleSheets,
      accessToken: tokenJson.access_token,
      tokenExpiry: expiry,
    },
  });
  return tokenJson.access_token;
}

export async function grantGoogleSheetEditorAccess(input: {
  spreadsheetId: string;
  email: string;
}) {
  const spreadsheetId = String(input.spreadsheetId || "").trim();
  const email = String(input.email || "").trim().toLowerCase();
  if (!spreadsheetId) throw new Error("Spreadsheet ID is required.");
  if (!email || !email.includes("@")) throw new Error("Valid Google email is required.");

  const accessToken = await getGoogleSheetsAccessToken();
  const response = await fetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(
      spreadsheetId
    )}/permissions?supportsAllDrives=true&sendNotificationEmail=true`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        type: "user",
        role: "writer",
        emailAddress: email,
      }),
    }
  );
  const json = (await response.json().catch(() => null)) as
    | { id?: string; error?: { message?: string } }
    | null;
  if (!response.ok) {
    throw new Error(
      json?.error?.message ||
        "Unable to grant Google Sheet editor access. Reconnect Google with Drive permission and retry."
    );
  }
  await verifyGoogleSheetEmailAccess({ spreadsheetId, email });
  return { ok: true, permissionId: String(json?.id || "") };
}

export async function verifyGoogleSheetEmailAccess(input: {
  spreadsheetId: string;
  email: string;
}) {
  const spreadsheetId = String(input.spreadsheetId || "").trim();
  const email = String(input.email || "").trim().toLowerCase();
  const accessToken = await getGoogleSheetsAccessToken();
  const response = await fetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(
      spreadsheetId
    )}/permissions?fields=permissions(id,emailAddress,role,type)&supportsAllDrives=true`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      cache: "no-store",
    }
  );
  const json = (await response.json().catch(() => null)) as
    | { permissions?: Array<{ id?: string; emailAddress?: string; role?: string; type?: string }>; error?: { message?: string } }
    | null;
  if (!response.ok) {
    throw new Error(json?.error?.message || "Unable to verify Google Sheet permission.");
  }
  const permissions = Array.isArray(json?.permissions) ? json.permissions : [];
  const matched = permissions.find(
    (entry) => String(entry.emailAddress || "").trim().toLowerCase() === email
  );
  if (!matched) {
    throw new Error("Google granted response received, but target email permission was not found. Reconnect Google and retry.");
  }
  return matched;
}

export async function revokeGoogleSheetEmailAccess(input: {
  spreadsheetId: string;
  email: string;
}) {
  const spreadsheetId = String(input.spreadsheetId || "").trim();
  const email = String(input.email || "").trim().toLowerCase();
  if (!spreadsheetId) throw new Error("Spreadsheet ID is required.");
  if (!email || !email.includes("@")) throw new Error("Valid Google email is required.");

  const accessToken = await getGoogleSheetsAccessToken();
  const listRes = await fetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(
      spreadsheetId
    )}/permissions?fields=permissions(id,emailAddress,role,type)&supportsAllDrives=true`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      cache: "no-store",
    }
  );
  const listJson = (await listRes.json().catch(() => null)) as
    | {
        permissions?: Array<{ id?: string; emailAddress?: string; role?: string; type?: string }>;
        error?: { message?: string };
      }
    | null;
  if (!listRes.ok) {
    throw new Error(listJson?.error?.message || "Unable to list Google Sheet permissions.");
  }

  const permissions = Array.isArray(listJson?.permissions) ? listJson.permissions : [];
  const targetPermission = permissions.find(
    (entry) => String(entry.emailAddress || "").trim().toLowerCase() === email
  );
  const broadPermissions = permissions.filter((entry) => {
    const type = String(entry.type || "").toLowerCase();
    const role = String(entry.role || "").toLowerCase();
    if (!entry.id) return false;
    if (type !== "anyone" && type !== "domain") return false;
    return role === "reader" || role === "commenter" || role === "writer";
  });

  const toDelete = [
    ...(targetPermission?.id ? [targetPermission.id] : []),
    ...broadPermissions.map((entry) => String(entry.id || "")),
  ].filter(Boolean);

  for (const permissionId of toDelete) {
    const deleteRes = await fetch(
      `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(
        spreadsheetId
      )}/permissions/${encodeURIComponent(permissionId)}?supportsAllDrives=true`,
      {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    if (!deleteRes.ok) {
      const deleteJson = (await deleteRes.json().catch(() => null)) as
        | { error?: { message?: string } }
        | null;
      throw new Error(deleteJson?.error?.message || "Unable to revoke Google Sheet access.");
    }
  }

  return { ok: true, revoked: toDelete.length > 0 };
}

export async function auditGoogleSheetPermissions(input: { spreadsheetId: string; email?: string }) {
  const spreadsheetId = String(input.spreadsheetId || "").trim();
  const email = String(input.email || "").trim().toLowerCase();
  if (!spreadsheetId) throw new Error("Spreadsheet ID is required.");

  const accessToken = await getGoogleSheetsAccessToken();
  const response = await fetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(
      spreadsheetId
    )}/permissions?fields=permissions(id,emailAddress,role,type,domain,allowFileDiscovery)&supportsAllDrives=true`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      cache: "no-store",
    }
  );
  const json = (await response.json().catch(() => null)) as
    | {
        permissions?: Array<{
          id?: string;
          emailAddress?: string;
          role?: string;
          type?: string;
          domain?: string;
          allowFileDiscovery?: boolean;
        }>;
        error?: { message?: string };
      }
    | null;
  if (!response.ok) {
    throw new Error(json?.error?.message || "Unable to audit Google Sheet permissions.");
  }

  const permissions = Array.isArray(json?.permissions) ? json.permissions : [];
  const emailPermission = email
    ? permissions.find(
        (entry) => String(entry.emailAddress || "").trim().toLowerCase() === email
      ) || null
    : null;
  const broadPermissions = permissions.filter((entry) => {
    const t = String(entry.type || "").toLowerCase();
    return t === "anyone" || t === "domain";
  });

  return {
    spreadsheetId,
    email,
    emailHasDirectPermission: Boolean(emailPermission),
    emailPermission,
    broadPermissions,
    permissions,
  };
}

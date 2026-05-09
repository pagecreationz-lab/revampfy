import "server-only";
import fs from "fs/promises";
import path from "path";
import { decryptConfigValue, encryptConfigValue } from "@/lib/secureConfig";
import { getAdminIntegrationSettings } from "@/lib/adminIntegrations";

export type VendorSheetLink = {
  vendorId: string;
  vendorEmail: string;
  googleLoginEmail?: string;
  googleUserId?: string;
  lastGoogleLoginAt?: string;
  allowedGoogleEmails?: string[];
  sheetId: string;
  sheetUrl: string;
  sheetName: string;
  syncStatus: "active" | "inactive" | "failed";
  enabled: boolean;
  lastSyncedAt: string;
  lastSyncMessage: string;
  accessToken: string;
  refreshToken: string;
  tokenExpiry: number;
  updatedAt: string;
};

export type VendorSheetSyncLog = {
  id: string;
  vendorId: string;
  at: string;
  status: "success" | "error";
  message: string;
  productsProcessed: number;
};

const linksPath = path.join(process.cwd(), "data", "vendor-sheet-links.json");
const logsPath = path.join(process.cwd(), "data", "vendor-sheet-sync-logs.json");

function extractSpreadsheetIdFromUrl(urlOrId: string): string {
  const raw = String(urlOrId || "").trim();
  if (!raw) return "";
  if (!raw.includes("http")) return raw;
  const match = raw.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  return match?.[1] || "";
}

function toPublic(item: VendorSheetLink): VendorSheetLink {
  return {
    ...item,
    accessToken: item.accessToken ? "********" : "",
    refreshToken: item.refreshToken ? "********" : "",
  };
}

export async function listVendorSheetLinks(rawSecrets = false): Promise<VendorSheetLink[]> {
  try {
    const raw = await fs.readFile(linksPath, "utf8");
    const parsed = JSON.parse(raw) as VendorSheetLink[];
    const normalized: VendorSheetLink[] = (Array.isArray(parsed) ? parsed : []).map((entry) => ({
      vendorId: String(entry.vendorId || "").trim(),
      vendorEmail: String(entry.vendorEmail || "").trim().toLowerCase(),
      googleLoginEmail: String(entry.googleLoginEmail || "").trim().toLowerCase(),
      googleUserId: String(entry.googleUserId || "").trim(),
      lastGoogleLoginAt: String(entry.lastGoogleLoginAt || "").trim(),
      allowedGoogleEmails: Array.isArray(entry.allowedGoogleEmails)
        ? entry.allowedGoogleEmails.map((e) => String(e || "").trim().toLowerCase()).filter(Boolean)
        : [],
      sheetId: String(entry.sheetId || "").trim(),
      sheetUrl: String(entry.sheetUrl || "").trim(),
      sheetName: String(entry.sheetName || "Sheet1").trim() || "Sheet1",
      syncStatus:
        entry.syncStatus === "active" || entry.syncStatus === "failed" || entry.syncStatus === "inactive"
          ? entry.syncStatus
          : "inactive",
      enabled: Boolean(entry.enabled),
      lastSyncedAt: String(entry.lastSyncedAt || ""),
      lastSyncMessage: String(entry.lastSyncMessage || ""),
      accessToken: decryptConfigValue(String(entry.accessToken || "")),
      refreshToken: decryptConfigValue(String(entry.refreshToken || "")),
      tokenExpiry: Number(entry.tokenExpiry || 0),
      updatedAt: String(entry.updatedAt || ""),
    }));
    return rawSecrets ? normalized : normalized.map(toPublic);
  } catch {
    return [];
  }
}

export async function getVendorSheetLink(vendorId: string, rawSecrets = false) {
  const links = await listVendorSheetLinks(rawSecrets);
  return links.find((entry) => entry.vendorId === String(vendorId || "").trim()) || null;
}

export async function upsertVendorSheetLink(input: Partial<VendorSheetLink> & { vendorId: string; vendorEmail: string }) {
  const links = await listVendorSheetLinks(true);
  const vendorId = String(input.vendorId || "").trim();
  const index = links.findIndex((entry) => entry.vendorId === vendorId);
  const current = index >= 0 ? links[index] : null;
  const sheetUrl = String(input.sheetUrl ?? current?.sheetUrl ?? "").trim();
  const sheetId = String(input.sheetId ?? current?.sheetId ?? extractSpreadsheetIdFromUrl(sheetUrl)).trim();
  const next: VendorSheetLink = {
    vendorId,
    vendorEmail: String(input.vendorEmail || current?.vendorEmail || "").trim().toLowerCase(),
    googleLoginEmail: String(input.googleLoginEmail ?? current?.googleLoginEmail ?? "").trim().toLowerCase(),
    googleUserId: String(input.googleUserId ?? current?.googleUserId ?? "").trim(),
    lastGoogleLoginAt: String(input.lastGoogleLoginAt ?? current?.lastGoogleLoginAt ?? "").trim(),
    allowedGoogleEmails: Array.isArray(input.allowedGoogleEmails)
      ? input.allowedGoogleEmails.map((e) => String(e || "").trim().toLowerCase()).filter(Boolean)
      : current?.allowedGoogleEmails || [],
    sheetId,
    sheetUrl,
    sheetName: String(input.sheetName ?? current?.sheetName ?? "Sheet1").trim() || "Sheet1",
    syncStatus:
      input.syncStatus === "active" || input.syncStatus === "inactive" || input.syncStatus === "failed"
        ? input.syncStatus
        : current?.syncStatus || "inactive",
    enabled: typeof input.enabled === "boolean" ? input.enabled : current?.enabled ?? true,
    lastSyncedAt: String(input.lastSyncedAt ?? current?.lastSyncedAt ?? ""),
    lastSyncMessage: String(input.lastSyncMessage ?? current?.lastSyncMessage ?? ""),
    accessToken: String(input.accessToken || current?.accessToken || "").trim(),
    refreshToken: String(input.refreshToken || current?.refreshToken || "").trim(),
    tokenExpiry: Number(input.tokenExpiry ?? current?.tokenExpiry ?? 0),
    updatedAt: new Date().toISOString(),
  };
  if (index >= 0) links[index] = next;
  else links.push(next);
  await saveVendorSheetLinksRaw(links);
  return toPublic(next);
}

export async function deleteVendorSheetLink(vendorId: string) {
  const links = await listVendorSheetLinks(true);
  const next = links.filter((entry) => entry.vendorId !== String(vendorId || "").trim());
  await saveVendorSheetLinksRaw(next);
}

async function saveVendorSheetLinksRaw(links: VendorSheetLink[]) {
  const persisted = links.map((entry) => ({
    ...entry,
    accessToken: entry.accessToken ? encryptConfigValue(entry.accessToken) : "",
    refreshToken: entry.refreshToken ? encryptConfigValue(entry.refreshToken) : "",
  }));
  await fs.mkdir(path.dirname(linksPath), { recursive: true });
  await fs.writeFile(linksPath, JSON.stringify(persisted, null, 2), "utf8");
}

export async function appendVendorSheetSyncLog(input: Omit<VendorSheetSyncLog, "id" | "at">) {
  const logs = await listVendorSheetSyncLogs();
  const next: VendorSheetSyncLog = {
    id: `vsync_${Math.random().toString(36).slice(2, 10)}`,
    at: new Date().toISOString(),
    ...input,
  };
  const merged = [next, ...logs].slice(0, 500);
  await fs.mkdir(path.dirname(logsPath), { recursive: true });
  await fs.writeFile(logsPath, JSON.stringify(merged, null, 2), "utf8");
}

export async function listVendorSheetSyncLogs(vendorId?: string): Promise<VendorSheetSyncLog[]> {
  try {
    const raw = await fs.readFile(logsPath, "utf8");
    const parsed = JSON.parse(raw) as VendorSheetSyncLog[];
    const logs = Array.isArray(parsed) ? parsed : [];
    if (!vendorId) return logs;
    const id = String(vendorId || "").trim();
    return logs.filter((entry) => entry.vendorId === id);
  } catch {
    return [];
  }
}

export async function getVendorGoogleAccessToken(vendorId: string): Promise<string> {
  const link = await getVendorSheetLink(vendorId, true);
  if (!link) throw new Error("Vendor sheet link not found.");
  const now = Date.now();
  if (link.accessToken && link.tokenExpiry - 60_000 > now) {
    return link.accessToken;
  }
  const admin = await getAdminIntegrationSettings();
  if (!admin.googleSheets.clientId || !admin.googleSheets.clientSecret) {
    throw new Error("Google OAuth client is not configured by admin.");
  }
  if (!link.refreshToken) {
    if (admin.googleSheets.accessToken && Number(admin.googleSheets.tokenExpiry || 0) - 60_000 > now) {
      await upsertVendorSheetLink({
        vendorId: link.vendorId,
        vendorEmail: link.vendorEmail,
        sheetId: link.sheetId,
        sheetUrl: link.sheetUrl,
        sheetName: link.sheetName,
        enabled: link.enabled,
        syncStatus: link.syncStatus,
        lastSyncedAt: link.lastSyncedAt,
        lastSyncMessage: link.lastSyncMessage,
        accessToken: admin.googleSheets.accessToken,
        refreshToken: admin.googleSheets.refreshToken,
        tokenExpiry: Number(admin.googleSheets.tokenExpiry || 0),
      });
      return admin.googleSheets.accessToken;
    }
    if (!admin.googleSheets.refreshToken) {
      throw new Error("Vendor Google connection expired. Reconnect Google Sheet.");
    }
  }
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: admin.googleSheets.clientId,
      client_secret: admin.googleSheets.clientSecret,
      refresh_token: link.refreshToken,
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
    throw new Error(tokenJson.error_description || tokenJson.error || "Failed to refresh vendor Google token.");
  }
  const expiry = Date.now() + Math.max(300, Number(tokenJson.expires_in || 3600)) * 1000;
  await upsertVendorSheetLink({
    vendorId: link.vendorId,
    vendorEmail: link.vendorEmail,
    sheetId: link.sheetId,
    sheetUrl: link.sheetUrl,
    sheetName: link.sheetName,
    enabled: link.enabled,
    syncStatus: link.syncStatus,
    lastSyncedAt: link.lastSyncedAt,
    lastSyncMessage: link.lastSyncMessage,
    refreshToken: link.refreshToken,
    accessToken: tokenJson.access_token,
    tokenExpiry: expiry,
  });
  return tokenJson.access_token;
}

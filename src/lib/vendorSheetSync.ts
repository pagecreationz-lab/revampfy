import "server-only";
import {
  appendVendorSheetSyncLog,
  getVendorGoogleAccessToken,
  getVendorSheetLink,
  listVendorSheetLinks,
  upsertVendorSheetLink,
} from "@/lib/vendorSheetLinks";
import { createCatalogProduct, getProducts, replaceCatalogProduct, type CatalogProduct } from "@/lib/catalog";
import { upsertVendorSheetApproval } from "@/lib/vendorSheetApprovals";

function slugify(input: string) {
  return String(input || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function toNumber(value: string, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function getHeaderIndex(headers: string[], aliases: readonly string[]) {
  for (const alias of aliases) {
    const index = headers.indexOf(alias);
    if (index >= 0) return index;
  }
  return -1;
}

function getCellByAliases(row: string[], headers: string[], aliases: readonly string[]) {
  const index = getHeaderIndex(headers, aliases);
  return index >= 0 ? String(row[index] || "").trim() : "";
}

async function resolveWorkingSheetName(
  sheetId: string,
  accessToken: string,
  preferredName: string
): Promise<string> {
  const tryNames = [preferredName, "Sheet1"].filter(Boolean);
  for (const name of tryNames) {
    const range = encodeURIComponent(`${name}!A1:F2`);
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(sheetId)}/values/${range}`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    });
    if (res.ok) return name;
  }

  const metaUrl = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
    sheetId
  )}?fields=sheets(properties(title))`;
  const metaRes = await fetch(metaUrl, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  const metaJson = (await metaRes.json().catch(() => ({}))) as {
    sheets?: Array<{ properties?: { title?: string } }>;
  };
  const firstTitle = Array.isArray(metaJson.sheets)
    ? String(metaJson.sheets[0]?.properties?.title || "").trim()
    : "";
  return firstTitle || preferredName || "Sheet1";
}

export async function testVendorSheetConnection(vendorId: string) {
  const link = await getVendorSheetLink(vendorId, true);
  if (!link || !link.sheetId) throw new Error("Vendor sheet is not connected.");
  const token = await getVendorGoogleAccessToken(vendorId);
  const workingSheetName = await resolveWorkingSheetName(
    link.sheetId,
    token,
    link.sheetName || "Sheet1"
  );
  const range = encodeURIComponent(`${workingSheetName}!A1:F2`);
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(link.sheetId)}/values/${range}`;
  const headers: Record<string, string> = { Authorization: `Bearer ${token}` };
  const res = await fetch(url, { headers, cache: "no-store" });
  if (!res.ok) {
    const json = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
    throw new Error(json?.error?.message || "Unable to access vendor sheet.");
  }
  if (workingSheetName !== (link.sheetName || "Sheet1")) {
    await upsertVendorSheetLink({
      vendorId: link.vendorId,
      vendorEmail: link.vendorEmail,
      sheetId: link.sheetId,
      sheetUrl: link.sheetUrl,
      sheetName: workingSheetName,
      enabled: link.enabled,
      accessToken: link.accessToken,
      refreshToken: link.refreshToken,
      tokenExpiry: link.tokenExpiry,
      syncStatus: link.syncStatus,
      lastSyncedAt: link.lastSyncedAt,
      lastSyncMessage: link.lastSyncMessage,
    });
  }
  return true;
}

export async function syncVendorSheet(vendorId: string) {
  const link = await getVendorSheetLink(vendorId, true);
  if (!link || !link.sheetId) throw new Error("Vendor sheet is not connected.");
  if (!link.enabled) throw new Error("Vendor sheet sync is disabled.");

  const token = await getVendorGoogleAccessToken(vendorId);
  const workingSheetName = await resolveWorkingSheetName(
    link.sheetId,
    token,
    link.sheetName || "Sheet1"
  );
  const range = encodeURIComponent(`${workingSheetName}!A1:Z5000`);
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(link.sheetId)}/values/${range}`;
  const headers: Record<string, string> = { Authorization: `Bearer ${token}` };
  const res = await fetch(url, { headers, cache: "no-store" });
  const json = (await res.json().catch(() => ({}))) as { values?: string[][]; error?: { message?: string } };
  if (!res.ok) throw new Error(json?.error?.message || "Unable to read vendor sheet.");
  const values = Array.isArray(json.values) ? json.values : [];
  if (values.length < 1) {
    throw new Error("Sheet is empty. Add header row first.");
  }

  const headersRow = values[0].map((h) => String(h || "").trim().toLowerCase());
  const headerAliases = {
    sku: ["sku", "product id", "id", "handle"],
    title: ["product name", "title", "product_title", "name"],
    price: ["price", "sale price", "mrp", "amount"],
    stock: ["stock", "inventory", "inventory quantity", "inventory_quantity", "qty", "quantity"],
    location: ["location", "state", "vendorstate", "service location"],
    category: ["category", "product type", "product_type", "type"],
  } as const;
  const missing: string[] = [];
  if (getHeaderIndex(headersRow, headerAliases.title) < 0) missing.push("Product Name/Title");
  if (getHeaderIndex(headersRow, headerAliases.price) < 0) missing.push("Price");
  if (missing.length) throw new Error(`Missing required columns: ${missing.join(", ")}.`);

  if (values.length === 1) {
    await upsertVendorSheetLink({
      vendorId: link.vendorId,
      vendorEmail: link.vendorEmail,
      sheetId: link.sheetId,
      sheetUrl: link.sheetUrl,
      sheetName: workingSheetName,
      enabled: link.enabled,
      accessToken: link.accessToken,
      refreshToken: link.refreshToken,
      tokenExpiry: link.tokenExpiry,
      syncStatus: "active",
      lastSyncedAt: new Date().toISOString(),
      lastSyncMessage: "Header validated. No product rows found (0 synced).",
    });
    await appendVendorSheetSyncLog({
      vendorId: link.vendorId,
      status: "success",
      message: "Header validated. No product rows found.",
      productsProcessed: 0,
    });
    return { processed: 0 };
  }

  const rows = values.slice(1);
  const products = await getProducts({ limit: 1000, status: "any", vendorManagedOnly: true });
  const existingByHandle = new Map(
    products.products.map((product) => [String(product.handle || "").trim().toLowerCase(), product])
  );

  let processed = 0;
  for (const row of rows) {
    const sku = getCellByAliases(row, headersRow, [...headerAliases.sku]);
    const title = getCellByAliases(row, headersRow, [...headerAliases.title]);
    const price = getCellByAliases(row, headersRow, [...headerAliases.price]);
    const stock = getCellByAliases(row, headersRow, [...headerAliases.stock]);
    const location = getCellByAliases(row, headersRow, [...headerAliases.location]);
    const category = getCellByAliases(row, headersRow, [...headerAliases.category]);
    if (!title) continue;

    const handle = slugify(sku) || slugify(title);
    const tags = [`vendorState:${location}`].filter(Boolean).join(", ");
    const payload: Partial<CatalogProduct> = {
      title,
      handle,
      status: "draft",
      vendor: link.vendorEmail,
      category,
      product_type: category,
      tags,
      variants: [
        {
          title: "Default",
          price: String(toNumber(price, 0)),
          compare_at_price: null,
          inventory_quantity: Math.max(0, toNumber(stock, 0)),
          requires_shipping: true,
        },
      ],
      metafields: [
        { namespace: "vendor", key: "vendor_id", value: vendorId, type: "single_line_text_field" },
        { namespace: "integration", key: "synced_from_sheet", value: "true", type: "single_line_text_field" },
        { namespace: "integration", key: "sheet_sku", value: sku, type: "single_line_text_field" },
        { namespace: "integration", key: "approval_status", value: "pending_approval", type: "single_line_text_field" },
      ],
    };
    let saved: CatalogProduct;
    const existing = existingByHandle.get(handle.toLowerCase());
    if (existing) {
      saved = await replaceCatalogProduct(existing.id, payload);
    } else {
      saved = await createCatalogProduct(payload);
    }
    await upsertVendorSheetApproval({
      vendorId: link.vendorId,
      vendorEmail: link.vendorEmail,
      sheetId: link.sheetId,
      sheetName: workingSheetName,
      sheetUrl: link.sheetUrl,
      productId: saved.id,
      productTitle: saved.title,
      productHandle: saved.handle,
      previousProduct: existing || null,
      syncedProduct: saved,
    });
    processed += 1;
  }

  await upsertVendorSheetLink({
    vendorId: link.vendorId,
    vendorEmail: link.vendorEmail,
      sheetId: link.sheetId,
      sheetUrl: link.sheetUrl,
      sheetName: workingSheetName,
    enabled: link.enabled,
    accessToken: link.accessToken,
    refreshToken: link.refreshToken,
    tokenExpiry: link.tokenExpiry,
    syncStatus: "active",
    lastSyncedAt: new Date().toISOString(),
    lastSyncMessage: `Sync complete. ${processed} product(s) processed.`,
  });
  await appendVendorSheetSyncLog({
    vendorId: link.vendorId,
    status: "success",
    message: "Sync complete.",
    productsProcessed: processed,
  });
  return { processed };
}

export async function syncAllVendorsSheets() {
  const links = await listVendorSheetLinks(true);
  let synced = 0;
  let failed = 0;
  for (const link of links.filter((entry) => entry.enabled && entry.sheetId)) {
    try {
      // eslint-disable-next-line no-await-in-loop
      await syncVendorSheet(link.vendorId);
      synced += 1;
    } catch (error) {
      failed += 1;
      const message = error instanceof Error ? error.message : "Sync failed.";
      // eslint-disable-next-line no-await-in-loop
      await upsertVendorSheetLink({
        vendorId: link.vendorId,
        vendorEmail: link.vendorEmail,
        syncStatus: "failed",
        lastSyncMessage: message,
        lastSyncedAt: new Date().toISOString(),
      });
      // eslint-disable-next-line no-await-in-loop
      await appendVendorSheetSyncLog({
        vendorId: link.vendorId,
        status: "error",
        message,
        productsProcessed: 0,
      });
    }
  }
  return { synced, failed };
}

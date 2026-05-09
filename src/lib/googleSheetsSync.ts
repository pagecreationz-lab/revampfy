import "server-only";
import {
  appendGoogleSheetsSyncLog,
  getAdminIntegrationSettings,
  getGoogleSheetsAccessToken,
  saveAdminIntegrationSettings,
} from "@/lib/adminIntegrations";
import { getVendorPortalData, saveVendorPortalData, type VendorRecord } from "@/lib/vendorPortal";
import {
  createCatalogProduct,
  getProducts,
  replaceCatalogProduct,
  type CatalogProduct,
} from "@/lib/catalog";

function slugify(input: string) {
  return String(input || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function safeNumber(value: string, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function getCell(row: string[], headers: string[], key: string) {
  const index = headers.indexOf(key);
  return index >= 0 ? String(row[index] || "").trim() : "";
}

function parseVariantJson(raw: string): Array<{
  title: string;
  price: string;
  compare_at_price?: string | null;
  inventory_quantity?: number;
}> {
  const text = String(raw || "").trim();
  if (!text) return [];
  try {
    const parsed = JSON.parse(text) as Array<Record<string, unknown>>;
    if (!Array.isArray(parsed)) return [];
    return parsed.map((entry) => ({
      title: String(entry.title || "Default").trim() || "Default",
      price: String(entry.price || "0").trim() || "0",
      compare_at_price: String(entry.compare_at_price || "").trim() || null,
      inventory_quantity: safeNumber(String(entry.inventory_quantity || "0"), 0),
    }));
  } catch {
    return [];
  }
}

type ProductGroup = {
  title: string;
  handle: string;
  status: string;
  vendor: string;
  vendorEmail: string;
  product_type: string;
  category: string;
  tags: string;
  description: string;
  collectionHandles: string[];
  imageUrls: string[];
  variants: Array<{
    title: string;
    price: string;
    compare_at_price?: string | null;
    inventory_quantity?: number;
  }>;
};

export async function runGoogleSheetSync(sheetNameOverride?: string) {
  const settings = await getAdminIntegrationSettings();
  const spreadsheetId = settings.googleSheets.spreadsheetId;
  if (!spreadsheetId) throw new Error("Spreadsheet ID is required in Integrations settings.");

  const accessToken = await getGoogleSheetsAccessToken();
  const range = encodeURIComponent(`${sheetNameOverride || settings.googleSheets.sheetName || "Sheet1"}!A1:ZZ5000`);
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${range}`;
  const sheetRes = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  const sheetJson = (await sheetRes.json()) as { values?: string[][]; error?: { message?: string } };
  if (!sheetRes.ok) throw new Error(sheetJson?.error?.message || "Unable to read Google Sheet.");

  const values = Array.isArray(sheetJson.values) ? sheetJson.values : [];
  if (values.length < 2) throw new Error("Sheet must include header + at least one row.");
  const headers = values[0].map((h) => String(h || "").trim().toLowerCase());
  const rows = values.slice(1);

  const portal = await getVendorPortalData();
  const vendors = [...portal.vendors];
  let vendorsProcessed = 0;

  const groupedProducts = new Map<string, ProductGroup>();
  for (const row of rows) {
    const rowType = (getCell(row, headers, "row_type") || "product").toLowerCase();
    if (rowType === "vendor") {
      const name = getCell(row, headers, "name");
      const email = getCell(row, headers, "email").toLowerCase();
      if (!name || !email) continue;
      const existingIndex = vendors.findIndex((v) => v.email.toLowerCase() === email);
      const prev = existingIndex >= 0 ? vendors[existingIndex] : null;
      const record: VendorRecord = {
        id: prev?.id || `vendor_${Math.random().toString(36).slice(2, 10)}`,
        name,
        code: getCell(row, headers, "code") || slugify(name),
        email,
        phone: getCell(row, headers, "phone"),
        contactPerson: getCell(row, headers, "contact_person"),
        businessName: getCell(row, headers, "business_name"),
        address: getCell(row, headers, "address"),
        city: getCell(row, headers, "city"),
        state: getCell(row, headers, "state"),
        pincode: getCell(row, headers, "pincode"),
        states: (getCell(row, headers, "states_csv") || getCell(row, headers, "states"))
          .split(",")
          .map((entry) => entry.trim())
          .filter(Boolean),
        isActive: (getCell(row, headers, "is_active") || "true").toLowerCase() !== "false",
        commissionPercent: Math.min(100, Math.max(0, safeNumber(getCell(row, headers, "commission_percent"), 10))),
        passwordHash: prev?.passwordHash || "",
      };
      if (existingIndex >= 0) vendors[existingIndex] = record;
      else vendors.push(record);
      vendorsProcessed += 1;
      continue;
    }

    const title = getCell(row, headers, "title");
    const handle = getCell(row, headers, "handle") || slugify(title);
    const groupKey = getCell(row, headers, "group_key") || handle || slugify(title);
    if (!groupKey) continue;

    const current =
      groupedProducts.get(groupKey) ||
      ({
        title: title || groupKey,
        handle: handle || slugify(title || groupKey),
        status: getCell(row, headers, "status") || "active",
        vendor: getCell(row, headers, "vendor"),
        vendorEmail: getCell(row, headers, "vendor_email").toLowerCase(),
        product_type: getCell(row, headers, "product_type"),
        category: getCell(row, headers, "category"),
        tags: getCell(row, headers, "tags"),
        description: getCell(row, headers, "description"),
        collectionHandles: [],
        imageUrls: [],
        variants: [],
      } satisfies ProductGroup);

    if (title) current.title = title;
    if (handle) current.handle = handle;
    const status = getCell(row, headers, "status");
    if (status) current.status = status;
    const vendor = getCell(row, headers, "vendor");
    if (vendor) current.vendor = vendor;
    const vendorEmail = getCell(row, headers, "vendor_email").toLowerCase();
    if (vendorEmail) current.vendorEmail = vendorEmail;
    const pt = getCell(row, headers, "product_type");
    if (pt) current.product_type = pt;
    const cat = getCell(row, headers, "category");
    if (cat) current.category = cat;
    const tags = getCell(row, headers, "tags");
    if (tags) current.tags = tags;
    const desc = getCell(row, headers, "description");
    if (desc) current.description = desc;

    const collectionHandles = getCell(row, headers, "collection_handles");
    if (collectionHandles) {
      current.collectionHandles.push(...collectionHandles.split(",").map((entry) => slugify(entry)).filter(Boolean));
    }
    const imageUrls = getCell(row, headers, "image_urls");
    if (imageUrls) {
      current.imageUrls.push(...imageUrls.split("|").map((entry) => entry.trim()).filter(Boolean));
    }

    const fromJson = parseVariantJson(getCell(row, headers, "variants_json"));
    if (fromJson.length) current.variants.push(...fromJson);
    else {
      current.variants.push({
        title: getCell(row, headers, "variant_title") || "Default",
        price: getCell(row, headers, "variant_price") || "0",
        compare_at_price: getCell(row, headers, "compare_at_price") || null,
        inventory_quantity: safeNumber(getCell(row, headers, "inventory_quantity"), 0),
      });
    }
    groupedProducts.set(groupKey, current);
  }

  if (vendorsProcessed > 0) await saveVendorPortalData({ ...portal, vendors });
  const freshPortal = await getVendorPortalData();
  const vendorByEmail = new Map(freshPortal.vendors.map((v) => [String(v.email || "").trim().toLowerCase(), v]));
  const vendorByName = new Map(freshPortal.vendors.map((v) => [String(v.name || "").trim().toLowerCase(), v]));

  const existing = await getProducts({ limit: 1000, status: "any", vendorManagedOnly: true });
  const existingByHandle = new Map(existing.products.map((product) => [String(product.handle || "").trim().toLowerCase(), product]));
  let productsProcessed = 0;

  for (const group of groupedProducts.values()) {
    const dedupedVariants = group.variants.filter((variant, index, arr) => {
      return (
        arr.findIndex(
          (entry) =>
            String(entry.title || "Default").trim().toLowerCase() === String(variant.title || "Default").trim().toLowerCase() &&
            String(entry.price || "0").trim() === String(variant.price || "0").trim() &&
            String(entry.compare_at_price || "").trim() === String(variant.compare_at_price || "").trim() &&
            safeNumber(String(entry.inventory_quantity || 0)) === safeNumber(String(variant.inventory_quantity || 0))
        ) === index
      );
    });
    const vendor =
      vendorByEmail.get(group.vendorEmail) ||
      vendorByName.get(String(group.vendor || "").trim().toLowerCase()) ||
      null;
    const vendorName = vendor?.name || group.vendor || "";
    const vendorId = vendor?.id || "";
    const payload: Partial<CatalogProduct> = {
      title: group.title,
      handle: group.handle,
      status: group.status || "active",
      vendor: vendorName,
      product_type: group.product_type,
      category: group.category,
      tags: group.tags,
      description: group.description,
      description_html: group.description,
      collection_handles: Array.from(new Set(group.collectionHandles)),
      images: Array.from(new Set(group.imageUrls)).map((src) => ({ src })),
      variants: dedupedVariants.length
        ? dedupedVariants.map((variant) => ({
            title: variant.title || "Default",
            price: String(variant.price || "0"),
            compare_at_price: variant.compare_at_price || null,
            inventory_quantity: safeNumber(String(variant.inventory_quantity || "0"), 0),
            requires_shipping: true,
          }))
        : [{ title: "Default", price: "0", inventory_quantity: 0, requires_shipping: true }],
      metafields: vendorId
        ? [{ namespace: "vendor", key: "vendor_id", value: vendorId, type: "single_line_text_field" }]
        : [],
    };

    const existingProduct = existingByHandle.get(String(group.handle || "").trim().toLowerCase());
    if (existingProduct) await replaceCatalogProduct(existingProduct.id, payload);
    else await createCatalogProduct(payload);
    productsProcessed += 1;
  }

  const message = `Sync complete. Vendors: ${vendorsProcessed}, Products: ${productsProcessed}`;
  await saveAdminIntegrationSettings({
    googleSheets: {
      ...settings.googleSheets,
      lastSyncAt: new Date().toISOString(),
      lastSyncStatus: "success",
      lastSyncMessage: message,
    },
  });
  await appendGoogleSheetsSyncLog({
    status: "success",
    message,
    vendorsProcessed,
    productsProcessed,
  });
  return { message, vendorsProcessed, productsProcessed };
}


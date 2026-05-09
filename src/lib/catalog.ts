import "server-only";
import fs from "node:fs/promises";
import path from "node:path";
import { appendCustomerOrder, getCustomerUsers, type CustomerUser } from "@/lib/customerData";

export type CatalogCollection = {
  id: number;
  title: string;
  handle: string;
  body_html?: string | null;
  image?: { src: string } | null;
  collection_type?: "custom" | "smart" | "derived";
};

export type CatalogProduct = {
  id: number;
  title: string;
  handle: string;
  description?: string;
  description_html?: string;
  status?: string;
  tags?: string;
  vendor?: string;
  product_type?: string;
  category?: string;
  collection_handles?: string[];
  collection_titles?: string[];
  images?: { src: string }[];
  variants?: {
    id?: number;
    title?: string;
    price: string;
    compare_at_price?: string | null;
    inventory_quantity?: number;
    requires_shipping?: boolean;
  }[];
  metafields?: {
    namespace: string;
    key: string;
    value: string;
    type?: string;
  }[];
};

export type CatalogCustomer = {
  id: number;
  first_name?: string;
  last_name?: string;
  email?: string;
  state?: string;
  tags?: string;
  orders_count?: number;
  created_at?: string;
};

export type CatalogOrderSummary = {
  id: number;
  name: string;
  createdAt: string;
  financialStatus?: string;
  fulfillmentStatus?: string;
  totalPrice: number;
  statusUrl?: string;
};

export type CatalogSyncPayload = {
  categories: CatalogCollection[];
  brands: string[];
  vendors: string[];
  products: CatalogProduct[];
};

type CatalogStore = {
  collections: CatalogCollection[];
  products: CatalogProduct[];
  updatedAt: string;
};

type ProductVariant = NonNullable<CatalogProduct["variants"]>[number];

type LocalDraftOrder = {
  id: number;
  name: string;
  order_id?: number;
  status: string;
  paymentMethod?: string;
  paymentId?: string;
  transactionStatus?: string;
  invoice_url?: string;
  shipping?: {
    awb?: string;
    shipmentId?: string;
    status?: string;
    courier?: string;
    timeline?: Array<{ at: string; status: string; note?: string }>;
  };
  email: string;
  mobile?: string;
  address?: string;
  street?: string;
  area?: string;
  city?: string;
  state?: string;
  pincode?: string;
  location?: { lat?: string; lng?: string };
  totalPrice: number;
  lineItems: Array<{ variantId: number; quantity: number }>;
  createdAt: string;
};
const DRAFT_ORDER_EXPIRY_MS = 10 * 60 * 1000;

type VendorOrderSummary = {
  id: number;
  name: string;
  createdAt: string;
  financialStatus: string;
  fulfillmentStatus: string;
  totalPrice: number;
  statusUrl?: string;
  itemsCount: number;
  vendorAmount: number;
  customerName: string;
  customerMobile: string;
  customerAddress: string;
  customerStreet?: string;
  customerArea?: string;
  customerCity?: string;
  customerState?: string;
  customerPincode?: string;
  customerEmail: string;
  rawStatus?: string;
};

const cwd = process.cwd();
const isReadonlyServerlessCwd = cwd.startsWith("/var/task");
const runtimeDataDir =
  process.env.RUNTIME_DATA_DIR?.trim() ||
  (process.env.VERCEL || isReadonlyServerlessCwd
    ? path.join("/tmp", "laptop-reseller-data")
    : path.join(cwd, "data"));
const seedDataDir = path.join(cwd, "data");

const catalogPath = path.join(runtimeDataDir, "cms-catalog.json");
const seedCatalogPath = path.join(seedDataDir, "catalog-sync.json");
const draftOrdersPath = path.join(runtimeDataDir, "draft-orders.json");
const CATALOG_CACHE_TTL_MS = 5000;
const DRAFTS_CACHE_TTL_MS = 3000;
let catalogStoreCache: { value: CatalogStore; expiresAt: number } | null = null;
let draftOrdersCache: { value: LocalDraftOrder[]; expiresAt: number } | null = null;

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function toNumber(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function nextId(values: number[], start = 1000): number {
  const max = values.reduce((acc, v) => (v > acc ? v : acc), start - 1);
  return max + 1;
}

function normalizeVariant(index: number, variant: ProductVariant, productId: number) {
  const id = toNumber(variant?.id, productId * 1000 + index + 1);
  return {
    id,
    title: String(variant?.title || `Variant ${index + 1}`),
    price: String(variant?.price || "0"),
    compare_at_price:
      variant?.compare_at_price === null || variant?.compare_at_price === undefined
        ? null
        : String(variant.compare_at_price),
    inventory_quantity: toNumber(variant?.inventory_quantity, 0),
    requires_shipping: Boolean(variant?.requires_shipping),
  };
}

function normalizeProduct(input: CatalogProduct, allCollections: CatalogCollection[]): CatalogProduct {
  const id = toNumber(input.id);
  const title = String(input.title || "Untitled Product").trim();
  const handle = slugify(input.handle || title) || `product-${id}`;
  const collectionHandles = Array.isArray(input.collection_handles)
    ? input.collection_handles.map((entry) => slugify(String(entry))).filter(Boolean)
    : [];
  const collectionTitles = collectionHandles
    .map((entry) => allCollections.find((c) => c.handle === entry)?.title || "")
    .filter(Boolean);

  const incomingVariants = Array.isArray(input.variants) ? input.variants : [];
  const rawVariants =
    incomingVariants.length > 0
      ? incomingVariants.map((variant, index) => normalizeVariant(index, variant, id))
      : [
          {
            id: id * 1000 + 1,
            title: "Default",
            price: "0",
            compare_at_price: null,
            inventory_quantity: 0,
            requires_shipping: false,
          },
        ];

  // Ensure variant ids are unique within a product.
  const usedVariantIds = new Set<number>();
  const variants = rawVariants.map((variant, index) => {
    let nextId = toNumber(variant.id, id * 1000 + index + 1);
    while (usedVariantIds.has(nextId)) {
      nextId += 1;
    }
    usedVariantIds.add(nextId);
    return {
      ...variant,
      id: nextId,
      title: String(variant.title || `Variant ${index + 1}`),
    };
  });

  return {
    id,
    title,
    handle,
    description: String(input.description || ""),
    description_html: String(input.description_html || input.description || ""),
    status: String(input.status || "active"),
    tags: String(input.tags || ""),
    vendor: String(input.vendor || ""),
    product_type: String(input.product_type || ""),
    category: String(input.category || ""),
    collection_handles: collectionHandles,
    collection_titles: collectionTitles,
    images: Array.isArray(input.images)
      ? input.images
          .map((image) => ({ src: String(image?.src || "").trim() }))
          .filter((image) => Boolean(image.src))
      : [],
    variants,
    metafields: Array.isArray(input.metafields)
      ? input.metafields
          .map((entry) => ({
            namespace: String(entry.namespace || "custom").trim(),
            key: String(entry.key || "").trim(),
            value: String(entry.value || "").trim(),
            type: entry.type ? String(entry.type) : undefined,
          }))
          .filter((entry) => Boolean(entry.key && entry.value))
      : [],
  };
}

function normalizeCollection(input: CatalogCollection): CatalogCollection {
  const id = toNumber(input.id);
  const title = String(input.title || "Untitled Collection").trim();
  return {
    id,
    title,
    handle: slugify(input.handle || title) || `collection-${id}`,
    body_html: input.body_html ? String(input.body_html) : "",
    image: input.image?.src ? { src: String(input.image.src) } : null,
    collection_type: input.collection_type || "custom",
  };
}

function ensureUniqueProductHandle(
  desiredHandle: string,
  products: CatalogProduct[],
  excludeProductId?: number
): string {
  const base = slugify(desiredHandle) || "product";
  const taken = new Set(
    products
      .filter((product) => (excludeProductId ? product.id !== excludeProductId : true))
      .map((product) => String(product.handle || "").trim().toLowerCase())
      .filter(Boolean)
  );
  if (!taken.has(base)) return base;

  let suffix = 2;
  while (taken.has(`${base}-${suffix}`)) {
    suffix += 1;
  }
  return `${base}-${suffix}`;
}

function isVendorManagedProduct(product: CatalogProduct): boolean {
  const metafields = Array.isArray(product.metafields) ? product.metafields : [];
  return metafields.some(
    (entry) =>
      entry?.namespace === "vendor" &&
      entry?.key === "vendor_id" &&
      String(entry?.value || "").trim().length > 0
  );
}

export function filterVendorManagedProducts(products: CatalogProduct[]): CatalogProduct[] {
  return products.filter(isVendorManagedProduct);
}

async function readJson<T>(filePath: string, fallback: T): Promise<T> {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

async function writeJson<T>(filePath: string, payload: T): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(payload, null, 2), "utf8");
}

async function loadInitialCatalogFromSeed(): Promise<CatalogStore> {
  const seed = await readJson<{ payload?: CatalogSyncPayload } | null>(seedCatalogPath, null);
  const collections = (seed?.payload?.categories || []).map(normalizeCollection);
  const products = (seed?.payload?.products || []).map((product) => normalizeProduct(product, collections));
  return {
    collections,
    products,
    updatedAt: new Date().toISOString(),
  };
}

async function getCatalogStore(): Promise<CatalogStore> {
  if (catalogStoreCache && catalogStoreCache.expiresAt > Date.now()) {
    return catalogStoreCache.value;
  }
  const existing = await readJson<CatalogStore | null>(catalogPath, null);
  if (existing && Array.isArray(existing.collections) && Array.isArray(existing.products)) {
    const value = {
      collections: existing.collections.map(normalizeCollection),
      products: existing.products.map((product) =>
        normalizeProduct(product, existing.collections.map(normalizeCollection))
      ),
      updatedAt: existing.updatedAt || new Date().toISOString(),
    };
    catalogStoreCache = { value, expiresAt: Date.now() + CATALOG_CACHE_TTL_MS };
    return value;
  }

  const seeded = await loadInitialCatalogFromSeed();
  await writeJson(catalogPath, seeded);
  catalogStoreCache = { value: seeded, expiresAt: Date.now() + CATALOG_CACHE_TTL_MS };
  return seeded;
}

async function saveCatalogStore(store: CatalogStore): Promise<CatalogStore> {
  const normalizedCollections = store.collections.map(normalizeCollection);
  const normalizedProducts = store.products.map((product) => normalizeProduct(product, normalizedCollections));
  const normalized: CatalogStore = {
    collections: normalizedCollections,
    products: normalizedProducts,
    updatedAt: new Date().toISOString(),
  };
  await writeJson(catalogPath, normalized);
  catalogStoreCache = { value: normalized, expiresAt: Date.now() + CATALOG_CACHE_TTL_MS };
  return normalized;
}

export async function getCollections(): Promise<CatalogCollection[]> {
  const store = await getCatalogStore();
  return store.collections;
}

export async function getProducts(options?: {
  limit?: number;
  pageInfo?: string;
  status?: "active" | "draft" | "archived" | "any";
  vendorManagedOnly?: boolean;
}): Promise<{ products: CatalogProduct[]; pageInfo?: { next?: string; prev?: string } }> {
  const store = await getCatalogStore();
  const status = options?.status || "active";
  const statusFiltered =
    status === "any" ? store.products : store.products.filter((product) => (product.status || "active") === status);
  const filtered = options?.vendorManagedOnly
    ? filterVendorManagedProducts(statusFiltered)
    : statusFiltered;
  const limit = Math.max(1, Math.min(250, Number(options?.limit || 25)));
  const cursor = Number(options?.pageInfo || "0");
  const start = Number.isFinite(cursor) && cursor >= 0 ? cursor : 0;
  const products = filtered.slice(start, start + limit);
  const next = start + limit < filtered.length ? String(start + limit) : undefined;
  const prev = start - limit >= 0 ? String(start - limit) : undefined;
  return { products, pageInfo: { next, prev } };
}

export async function getCustomers(limit = 50): Promise<CatalogCustomer[]> {
  const users = await getCustomerUsers();
  return users.slice(0, Math.max(1, limit)).map((user, index) => ({
    id: index + 1,
    first_name: user.name.split(" ")[0] || user.name,
    last_name: user.name.split(" ").slice(1).join(" "),
    email: user.email,
    state: "enabled",
    tags: "local-cms",
    orders_count: 0,
    created_at: user.createdAt,
  }));
}

export async function upsertCustomerByEmail(input: {
  email: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  address1?: string;
}) {
  const email = String(input.email || "").trim().toLowerCase();
  if (!email) throw new Error("Customer email is required.");
  return {
    id: Date.now(),
    first_name: input.firstName || "Customer",
    last_name: input.lastName || "",
    email,
    state: "enabled",
    tags: "local-cms",
    created_at: new Date().toISOString(),
  } satisfies CatalogCustomer;
}

async function loadDraftOrders(): Promise<LocalDraftOrder[]> {
  if (draftOrdersCache && draftOrdersCache.expiresAt > Date.now()) {
    return draftOrdersCache.value;
  }
  const all = await readJson<LocalDraftOrder[]>(draftOrdersPath, []);
  const now = Date.now();
  const filtered = all.filter((order) => {
    const status = String(order.status || "").toLowerCase();
    if (status !== "draft") return true;
    const createdAt = new Date(order.createdAt || "").getTime();
    if (!Number.isFinite(createdAt)) return true;
    return now - createdAt < DRAFT_ORDER_EXPIRY_MS;
  });
  if (filtered.length !== all.length) {
    await saveDraftOrders(filtered);
  }
  draftOrdersCache = { value: filtered, expiresAt: Date.now() + DRAFTS_CACHE_TTL_MS };
  return filtered;
}

async function saveDraftOrders(orders: LocalDraftOrder[]): Promise<void> {
  await writeJson(draftOrdersPath, orders);
  draftOrdersCache = { value: orders, expiresAt: Date.now() + DRAFTS_CACHE_TTL_MS };
}

export async function getOrdersByEmail(email: string, limit = 25): Promise<CatalogOrderSummary[]> {
  const lower = email.trim().toLowerCase();
  if (!lower) return [];
  const drafts = await loadDraftOrders();
  return drafts
    .filter((order) => order.email.toLowerCase() === lower)
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
    .slice(0, Math.max(1, limit))
    .map((order) => ({
      id: order.order_id || order.id,
      name: order.name,
      createdAt: order.createdAt,
      financialStatus: order.status === "completed" ? "paid" : "pending",
      fulfillmentStatus: order.status === "completed" ? "fulfilled" : "unfulfilled",
      totalPrice: order.totalPrice,
      statusUrl: order.invoice_url,
    }));
}

export async function getOrdersByVendor(vendorName: string, limit = 30): Promise<VendorOrderSummary[]> {
  const vendorLower = vendorName.trim().toLowerCase();
  if (!vendorLower) return [];
  const drafts = await loadDraftOrders();
  const store = await getCatalogStore();
  const variantToVendor = new Map<number, string>();
  const variantPriceMap = new Map<number, number>();
  store.products.forEach((product) => {
    const vendor = String(product.vendor || "").trim().toLowerCase();
    (product.variants || []).forEach((variant) => {
      const variantId = toNumber(variant.id);
      if (variantId) variantToVendor.set(variantId, vendor);
      if (variantId) variantPriceMap.set(variantId, toNumber(variant.price, 0));
    });
  });
  const customers = await getCustomerUsers();
  const customersByEmail = new Map(
    customers.map((entry) => [entry.email.trim().toLowerCase(), entry])
  );

  return drafts
    .map((order) => {
      const itemsCount = order.lineItems.reduce((sum, item) => {
        const variantVendor = variantToVendor.get(item.variantId) || "";
        if (variantVendor !== vendorLower) return sum;
        return sum + Math.max(1, Number(item.quantity || 0));
      }, 0);
      const vendorAmount = order.lineItems.reduce((sum, item) => {
        const variantVendor = variantToVendor.get(item.variantId) || "";
        if (variantVendor !== vendorLower) return sum;
        const unitPrice = variantPriceMap.get(item.variantId) || 0;
        return sum + unitPrice * Math.max(1, Number(item.quantity || 0));
      }, 0);
      const customer = customersByEmail.get(order.email.trim().toLowerCase());

      return {
        id: order.order_id || order.id,
        name: order.name,
        createdAt: order.createdAt,
        financialStatus: order.status === "completed" ? "paid" : "pending",
        fulfillmentStatus: order.status === "completed" ? "fulfilled" : "unfulfilled",
        rawStatus: order.status,
        totalPrice: order.totalPrice,
        statusUrl: order.invoice_url,
        itemsCount,
        vendorAmount,
        customerName: String(customer?.name || order.email),
        customerMobile: String(customer?.mobile || order.mobile || ""),
        customerAddress: String(customer?.address || order.address || ""),
        customerStreet: String(customer?.street || order.street || ""),
        customerArea: String(customer?.area || order.area || ""),
        customerCity: String(customer?.city || order.city || ""),
        customerState: String(customer?.state || order.state || ""),
        customerPincode: String(customer?.pincode || order.pincode || ""),
        customerEmail: order.email,
      };
    })
    .filter((order) => order.itemsCount > 0)
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
    .slice(0, Math.max(1, limit));
}

export async function getProductById(id: number | string): Promise<CatalogProduct | null> {
  const idTextRaw = String(id || "").trim();
  const idText = (() => {
    try {
      return decodeURIComponent(idTextRaw);
    } catch {
      return idTextRaw;
    }
  })();
  if (!idText) return null;
  const idTextLower = idText.toLowerCase();

  const rawStore = await readJson<CatalogStore | null>(catalogPath, null);
  if (rawStore && Array.isArray(rawStore.products) && Array.isArray(rawStore.collections)) {
    const normalizedCollections = rawStore.collections.map(normalizeCollection);
    const byHandle = rawStore.products.find(
      (product) => String(product.handle || "").trim().toLowerCase() === idTextLower
    );
    if (byHandle) {
      return normalizeProduct(byHandle, normalizedCollections);
    }
    const byText = rawStore.products.find((product) => String(product.id) === idText);
    if (byText) {
      return normalizeProduct(byText, normalizedCollections);
    }
    const byTitleSlug = rawStore.products.find((product) => {
      const titleSlug = slugify(String(product.title || "").trim());
      return titleSlug === idTextLower;
    });
    if (byTitleSlug) {
      return normalizeProduct(byTitleSlug, normalizedCollections);
    }

    const idNumber = Number(idText);
    if (Number.isFinite(idNumber) && idNumber > 0) {
      const byNumber = rawStore.products.find((product) => toNumber(product.id) === idNumber);
      if (byNumber) {
        return normalizeProduct(byNumber, normalizedCollections);
      }
    }
    return null;
  }

  const store = await getCatalogStore();
  const byHandle = store.products.find(
    (product) => String(product.handle || "").trim().toLowerCase() === idTextLower
  );
  if (byHandle) return byHandle;
  const byTitleSlug = store.products.find(
    (product) => slugify(String(product.title || "").trim()) === idTextLower
  );
  if (byTitleSlug) return byTitleSlug;
  return (
    store.products.find((product) => String(product.id) === idText) ||
    null
  );
}

export async function getAllProducts(maxPages = 8): Promise<CatalogProduct[]> {
  const store = await getCatalogStore();
  const max = Math.max(1, maxPages) * 100;
  return store.products.slice(0, max);
}

export async function getCatalogSyncPayload(): Promise<CatalogSyncPayload> {
  const store = await getCatalogStore();
  const products = filterVendorManagedProducts(store.products);
  const collectionHandles = new Set(
    products.flatMap((product) => (product.collection_handles || []).map((handle) => handle.trim()).filter(Boolean))
  );
  const categories = store.collections.filter((collection) => collectionHandles.has(collection.handle));
  const brands = Array.from(new Set(products.map((p) => (p.product_type || p.category || "").trim()).filter(Boolean))).sort(
    (a, b) => a.localeCompare(b)
  );
  const vendors = Array.from(new Set(products.map((p) => (p.vendor || "").trim()).filter(Boolean))).sort((a, b) =>
    a.localeCompare(b)
  );
  return {
    categories,
    brands,
    vendors,
    products,
  };
}

export async function updateProduct(input: {
  id: number;
  title?: string;
  tags?: string;
  status?: string;
}): Promise<CatalogProduct> {
  const store = await getCatalogStore();
  const index = store.products.findIndex((product) => product.id === input.id);
  if (index < 0) throw new Error("Product not found.");
  const current = store.products[index];
  const next: CatalogProduct = normalizeProduct(
    {
      ...current,
      title: input.title ?? current.title,
      tags: input.tags ?? current.tags,
      status: input.status ?? current.status,
    },
    store.collections
  );
  store.products[index] = next;
  await saveCatalogStore(store);
  return next;
}

export async function updateCollection(input: {
  id: number;
  title?: string;
  body_html?: string;
  collection_type?: "custom" | "smart" | "derived";
}): Promise<CatalogCollection> {
  const store = await getCatalogStore();
  const index = store.collections.findIndex((collection) => collection.id === input.id);
  if (index < 0) throw new Error("Collection not found.");

  const current = store.collections[index];
  const next = normalizeCollection({
    ...current,
    title: input.title ?? current.title,
    body_html: input.body_html ?? current.body_html,
    collection_type: input.collection_type || current.collection_type,
  });

  store.collections[index] = next;
  await saveCatalogStore(store);
  return next;
}

export async function createCollection(input: {
  title: string;
  body_html?: string;
  collection_type?: "custom" | "smart" | "derived";
}): Promise<CatalogCollection> {
  const title = String(input.title || "").trim();
  if (!title) throw new Error("Collection title is required.");

  const store = await getCatalogStore();
  const existing = store.collections.find(
    (collection) => collection.title.trim().toLowerCase() === title.toLowerCase()
  );
  if (existing) return existing;

  const id = nextId(store.collections.map((collection) => collection.id), 1000);
  const next = normalizeCollection({
    id,
    title,
    handle: title,
    body_html: input.body_html || "",
    collection_type: input.collection_type || "custom",
  });
  store.collections.push(next);
  await saveCatalogStore(store);
  return next;
}

export async function createCatalogProduct(input: Partial<CatalogProduct>): Promise<CatalogProduct> {
  const store = await getCatalogStore();
  const productId = nextId(store.products.map((product) => product.id), 100000);
  const desiredHandle = String(input.handle || input.title || `product-${productId}`);
  const uniqueHandle = ensureUniqueProductHandle(desiredHandle, store.products);
  const base: CatalogProduct = {
    id: productId,
    title: String(input.title || "New Product"),
    handle: uniqueHandle,
    description: String(input.description || ""),
    description_html: String(input.description_html || input.description || ""),
    status: String(input.status || "active"),
    tags: String(input.tags || ""),
    vendor: String(input.vendor || ""),
    product_type: String(input.product_type || ""),
    category: String(input.category || ""),
    collection_handles: Array.isArray(input.collection_handles)
      ? input.collection_handles.map((entry) => slugify(String(entry))).filter(Boolean)
      : [],
    images: Array.isArray(input.images) ? input.images : [],
    variants: Array.isArray(input.variants) && input.variants.length ? input.variants : [{ title: "Default", price: "0" }],
    metafields: Array.isArray(input.metafields) ? input.metafields : [],
  };

  const next = normalizeProduct(base, store.collections);
  store.products.push(next);
  await saveCatalogStore(store);
  return next;
}

export async function replaceCatalogProduct(id: number, patch: Partial<CatalogProduct>): Promise<CatalogProduct> {
  const store = await getCatalogStore();
  const index = store.products.findIndex((product) => product.id === id);
  if (index < 0) throw new Error("Product not found.");
  const current = store.products[index];
  const desiredHandle = String(
    patch.handle || patch.title || current.handle || current.title || `product-${id}`
  );
  const uniqueHandle = ensureUniqueProductHandle(desiredHandle, store.products, id);
  const merged = {
    ...current,
    ...patch,
    handle: uniqueHandle,
    id,
  } as CatalogProduct;
  const next = normalizeProduct(merged, store.collections);
  store.products[index] = next;
  await saveCatalogStore(store);
  return next;
}

export async function deleteCatalogProduct(id: number): Promise<void> {
  const store = await getCatalogStore();
  const nextProducts = store.products.filter((product) => product.id !== id);
  if (nextProducts.length === store.products.length) {
    throw new Error("Product not found.");
  }
  store.products = nextProducts;
  await saveCatalogStore(store);
}

export async function createDraftOrder(input: {
  email: string;
  lineItems: Array<{ variantId: number; quantity: number }>;
  paymentMethod?: string;
  mobile?: string;
  address?: string;
  street?: string;
  area?: string;
  city?: string;
  state?: string;
  pincode?: string;
  location?: { lat?: string; lng?: string };
  note?: string;
}): Promise<{
  id: number;
  name?: string;
  status?: string;
  invoice_url?: string;
}> {
  const drafts = await loadDraftOrders();
  const store = await getCatalogStore();
  const variantPriceMap = new Map<number, number>();

  store.products.forEach((product) => {
    (product.variants || []).forEach((variant) => {
      const id = toNumber(variant.id);
      if (id) variantPriceMap.set(id, toNumber(variant.price, 0));
    });
  });

  const totalPrice = input.lineItems.reduce((sum, item) => {
    const unitPrice = variantPriceMap.get(item.variantId) || 0;
    return sum + unitPrice * Math.max(1, Number(item.quantity || 0));
  }, 0);

  const id = nextId(drafts.map((order) => order.id), 5000);
  const draft: LocalDraftOrder = {
    id,
    name: `DRAFT-${id}`,
    status: "draft",
    paymentMethod: String(input.paymentMethod || "online"),
    transactionStatus: "initiated",
    invoice_url: `/payment?draftOrderId=${id}`,
    email: input.email.trim().toLowerCase(),
    mobile: String(input.mobile || "").trim(),
    address: String(input.address || "").trim(),
    street: String(input.street || "").trim(),
    area: String(input.area || "").trim(),
    city: String(input.city || "").trim(),
    state: String(input.state || "").trim(),
    pincode: String(input.pincode || "").trim(),
    location: input.location,
    totalPrice,
    lineItems: input.lineItems.map((item) => ({
      variantId: Number(item.variantId),
      quantity: Math.max(1, Number(item.quantity || 1)),
    })),
    createdAt: new Date().toISOString(),
  };

  drafts.push(draft);
  await saveDraftOrders(drafts);

  return {
    id: draft.id,
    name: draft.name,
    status: draft.status,
    invoice_url: draft.invoice_url,
  };
}

export async function completeDraftOrderPaid(
  draftOrderId: number,
  payment?: { paymentId?: string; transactionStatus?: string; paymentMethod?: string }
): Promise<{
  id: number;
  name?: string;
  order_id?: number;
  status?: string;
}> {
  const drafts = await loadDraftOrders();
  const index = drafts.findIndex((draft) => draft.id === draftOrderId);
  if (index < 0) throw new Error("Draft order not found.");

  const current = drafts[index];
  const orderId = nextId(drafts.map((entry) => entry.order_id || 0), 10000);
  const completed: LocalDraftOrder = {
    ...current,
    order_id: orderId,
    status: "completed",
    paymentId: payment?.paymentId || current.paymentId,
    transactionStatus: payment?.transactionStatus || "paid",
    paymentMethod: payment?.paymentMethod || current.paymentMethod || "online",
  };

  drafts[index] = completed;
  await saveDraftOrders(drafts);

  await appendCustomerOrder({
    email: completed.email,
    orderRef: completed.name,
    status: "paid",
    paymentId: completed.paymentId,
    transactionStatus: completed.transactionStatus,
    paymentMethod: completed.paymentMethod,
    trackingId: completed.shipping?.awb,
    trackingStatus: completed.shipping?.status,
    courierPartner: completed.shipping?.courier,
    trackingTimeline: completed.shipping?.timeline,
    total: completed.totalPrice,
    invoiceUrl: completed.invoice_url,
    lineItems: completed.lineItems,
  });

  return {
    id: completed.id,
    name: completed.name,
    order_id: completed.order_id,
    status: completed.status,
  };
}

export async function markDraftOrderFailed(draftOrderId: number): Promise<{
  id: number;
  name?: string;
  status?: string;
}> {
  const drafts = await loadDraftOrders();
  const index = drafts.findIndex((draft) => draft.id === draftOrderId);
  if (index < 0) throw new Error("Draft order not found.");
  drafts[index] = {
    ...drafts[index],
    status: "failed",
    transactionStatus: "failed",
  };
  await saveDraftOrders(drafts);
  return {
    id: drafts[index].id,
    name: drafts[index].name,
    status: drafts[index].status,
  };
}

export async function attachShipmentToDraftOrder(
  draftOrderId: number,
  shipment: {
    awb?: string;
    shipmentId?: string;
    status?: string;
    courier?: string;
    timeline?: Array<{ at: string; status: string; note?: string }>;
  }
) {
  const drafts = await loadDraftOrders();
  const index = drafts.findIndex((draft) => draft.id === draftOrderId);
  if (index < 0) throw new Error("Draft order not found.");
  drafts[index] = {
    ...drafts[index],
    shipping: {
      ...drafts[index].shipping,
      ...shipment,
    },
  };
  await saveDraftOrders(drafts);
  return drafts[index];
}

export async function getDraftOrderStatus(draftOrderId: number): Promise<{
  id: number;
  name?: string;
  order_id?: number;
  status?: string;
  invoice_url?: string;
}> {
  const drafts = await loadDraftOrders();
  const draft = drafts.find((entry) => entry.id === draftOrderId);
  if (!draft) throw new Error("Draft order not found.");
  return {
    id: draft.id,
    name: draft.name,
    order_id: draft.order_id,
    status: draft.status,
    invoice_url: draft.invoice_url,
  };
}

export async function getDraftOrderSnapshot(draftOrderId: number) {
  const drafts = await loadDraftOrders();
  const draft = drafts.find((entry) => entry.id === draftOrderId);
  if (!draft) throw new Error("Draft order not found.");
  return draft;
}

export function stripHtml(value?: string | null): string {
  if (!value) return "";
  return value.replace(/<[^>]*>/g, "").trim();
}

export async function listAdminUsers(): Promise<Array<Omit<CustomerUser, "passwordHash">>> {
  const users = await getCustomerUsers();
  return users.map(({ passwordHash: _passwordHash, ...user }) => user);
}

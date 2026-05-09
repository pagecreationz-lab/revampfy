import "server-only";
import { filterVendorManagedProducts, getCatalogSyncPayload, type CatalogSyncPayload } from "@/lib/catalog";
import { getCatalogSyncStore, saveCatalogSyncStore, type CatalogSyncStore } from "@/lib/catalogSync";

function sanitizePayload(payload: CatalogSyncPayload): CatalogSyncPayload {
  const products = filterVendorManagedProducts(payload.products || []);
  const collectionHandles = new Set(
    products.flatMap((product) => (product.collection_handles || []).map((handle) => handle.trim()).filter(Boolean))
  );
  const categories = (payload.categories || []).filter((collection) =>
    collectionHandles.has(collection.handle)
  );
  const brands = Array.from(
    new Set(products.map((product) => (product.product_type || product.category || "").trim()).filter(Boolean))
  ).sort((a, b) => a.localeCompare(b));
  const vendors = Array.from(
    new Set(products.map((product) => (product.vendor || "").trim()).filter(Boolean))
  ).sort((a, b) => a.localeCompare(b));

  return {
    categories,
    products,
    brands,
    vendors,
  };
}

export async function getEffectiveCatalogSyncStore(options?: {
  forceSync?: boolean;
}): Promise<CatalogSyncStore> {
  const forceSync = Boolean(options?.forceSync);
  const cached = await getCatalogSyncStore();

  if (forceSync) {
    const payload = sanitizePayload(await getCatalogSyncPayload());
    return saveCatalogSyncStore(payload);
  }

  if (!cached) {
    const payload = sanitizePayload(await getCatalogSyncPayload());
    return saveCatalogSyncStore(payload);
  }

  const sanitized = sanitizePayload(cached.payload);
  const needsRewrite =
    sanitized.products.length !== (cached.payload.products || []).length ||
    sanitized.categories.length !== (cached.payload.categories || []).length;

  if (needsRewrite) {
    return saveCatalogSyncStore(sanitized);
  }

  return {
    ...cached,
    payload: sanitized,
  };
}


import "server-only";
import { getShopifySyncPayload } from "@/lib/shopify";
import { getShopifySyncStore, saveShopifySyncStore, type ShopifySyncStore } from "@/lib/shopifySync";
import { getShopifySyncSchedulerSettings } from "@/lib/shopifySyncScheduler";

const HOUR_MS = 60 * 60 * 1000;
const STALE_SYNC_MS = 5 * 60 * 1000;

function isHourlySyncDue(store: ShopifySyncStore): boolean {
  const lastSync = new Date(store.syncedAt).getTime();
  if (Number.isNaN(lastSync)) return true;
  return Date.now() - lastSync >= HOUR_MS;
}

function isCacheStale(store: ShopifySyncStore): boolean {
  const lastSync = new Date(store.syncedAt).getTime();
  if (Number.isNaN(lastSync)) return true;
  return Date.now() - lastSync >= STALE_SYNC_MS;
}

export async function getEffectiveShopifySyncStore(options?: {
  forceSync?: boolean;
}): Promise<ShopifySyncStore> {
  const forceSync = Boolean(options?.forceSync);
  const [cached, scheduler] = await Promise.all([
    getShopifySyncStore(),
    getShopifySyncSchedulerSettings(),
  ]);

  if (forceSync) {
    const payload = await getShopifySyncPayload();
    return saveShopifySyncStore(payload);
  }

  if (!cached) {
    const payload = await getShopifySyncPayload();
    return saveShopifySyncStore(payload);
  }

  // Even in manual mode, refresh stale cache so new Shopify collections/products
  // appear in frontend and CMS without requiring explicit manual sync every time.
  if (scheduler.mode === "manual" && isCacheStale(cached)) {
    try {
      const payload = await getShopifySyncPayload();
      return await saveShopifySyncStore(payload);
    } catch {
      return cached;
    }
  }

  if (scheduler.mode === "hourly" && isHourlySyncDue(cached)) {
    try {
      const payload = await getShopifySyncPayload();
      return await saveShopifySyncStore(payload);
    } catch {
      return cached;
    }
  }

  return cached;
}

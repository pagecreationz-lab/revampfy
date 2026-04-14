import "server-only";
import fs from "fs/promises";
import path from "path";
import type { ShopifySyncPayload } from "@/lib/shopify";

export type ShopifySyncStore = {
  syncedAt: string;
  payload: ShopifySyncPayload;
};

const syncPath = path.join(process.cwd(), "data", "shopify-sync.json");

export async function getShopifySyncStore(): Promise<ShopifySyncStore | null> {
  try {
    const raw = await fs.readFile(syncPath, "utf8");
    return JSON.parse(raw) as ShopifySyncStore;
  } catch {
    return null;
  }
}

export async function saveShopifySyncStore(payload: ShopifySyncPayload): Promise<ShopifySyncStore> {
  const value: ShopifySyncStore = {
    syncedAt: new Date().toISOString(),
    payload,
  };

  await fs.mkdir(path.dirname(syncPath), { recursive: true });
  await fs.writeFile(syncPath, JSON.stringify(value, null, 2), "utf8");
  return value;
}

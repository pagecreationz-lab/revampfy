import "server-only";
import fs from "fs/promises";
import path from "path";

export type ShopifySyncSchedulerMode = "manual" | "hourly";

export type ShopifySyncSchedulerSettings = {
  mode: ShopifySyncSchedulerMode;
};

const schedulerPath = path.join(process.cwd(), "data", "shopify-sync-scheduler.json");

const defaultSettings: ShopifySyncSchedulerSettings = {
  mode: "manual",
};

export async function getShopifySyncSchedulerSettings(): Promise<ShopifySyncSchedulerSettings> {
  try {
    const raw = await fs.readFile(schedulerPath, "utf8");
    const parsed = JSON.parse(raw) as Partial<ShopifySyncSchedulerSettings>;
    return {
      mode: parsed.mode === "hourly" ? "hourly" : "manual",
    };
  } catch {
    return defaultSettings;
  }
}

export async function saveShopifySyncSchedulerSettings(
  settings: ShopifySyncSchedulerSettings
): Promise<ShopifySyncSchedulerSettings> {
  const normalized: ShopifySyncSchedulerSettings = {
    mode: settings.mode === "hourly" ? "hourly" : "manual",
  };
  await fs.mkdir(path.dirname(schedulerPath), { recursive: true });
  await fs.writeFile(schedulerPath, JSON.stringify(normalized, null, 2), "utf8");
  return normalized;
}


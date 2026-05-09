import "server-only";
import fs from "fs/promises";
import path from "path";

export type CatalogSyncSchedulerMode = "manual" | "hourly";

export type CatalogSyncSchedulerSettings = {
  mode: CatalogSyncSchedulerMode;
};

const schedulerPath = path.join(process.cwd(), "data", "Catalog-sync-scheduler.json");

const defaultSettings: CatalogSyncSchedulerSettings = {
  mode: "manual",
};

export async function getCatalogSyncSchedulerSettings(): Promise<CatalogSyncSchedulerSettings> {
  try {
    const raw = await fs.readFile(schedulerPath, "utf8");
    const parsed = JSON.parse(raw) as Partial<CatalogSyncSchedulerSettings>;
    return {
      mode: parsed.mode === "hourly" ? "hourly" : "manual",
    };
  } catch {
    return defaultSettings;
  }
}

export async function saveCatalogSyncSchedulerSettings(
  settings: CatalogSyncSchedulerSettings
): Promise<CatalogSyncSchedulerSettings> {
  const normalized: CatalogSyncSchedulerSettings = {
    mode: settings.mode === "hourly" ? "hourly" : "manual",
  };
  await fs.mkdir(path.dirname(schedulerPath), { recursive: true });
  await fs.writeFile(schedulerPath, JSON.stringify(normalized, null, 2), "utf8");
  return normalized;
}



import "server-only";
import fs from "fs/promises";
import path from "path";

export type HomepageConfig = {
  categoryCollectionHandles: string[];
  featuredBrands: string[];
  featuredVendors: string[];
  studentsProductIds: number[];
  topSellingProductIds: number[];
};

const defaultConfig: HomepageConfig = {
  categoryCollectionHandles: [
    "laptops",
    "desktops",
    "mini-pc",
    "monitors",
    "gaming",
    "macbook",
  ],
  featuredBrands: [],
  featuredVendors: [],
  studentsProductIds: [],
  topSellingProductIds: [],
};

const dataPath = path.join(process.cwd(), "data", "homepage.json");
const CACHE_TTL_MS = 10000;
let homepageCache: { value: HomepageConfig; expiresAt: number } | null = null;

export async function getHomepageConfig(): Promise<HomepageConfig> {
  if (homepageCache && homepageCache.expiresAt > Date.now()) {
    return homepageCache.value;
  }
  try {
    const raw = await fs.readFile(dataPath, "utf8");
    const value = { ...defaultConfig, ...JSON.parse(raw) } as HomepageConfig;
    homepageCache = { value, expiresAt: Date.now() + CACHE_TTL_MS };
    return value;
  } catch {
    homepageCache = { value: defaultConfig, expiresAt: Date.now() + CACHE_TTL_MS };
    return defaultConfig;
  }
}

export async function saveHomepageConfig(config: HomepageConfig): Promise<void> {
  await fs.mkdir(path.dirname(dataPath), { recursive: true });
  await fs.writeFile(dataPath, JSON.stringify(config, null, 2), "utf8");
  homepageCache = { value: config, expiresAt: Date.now() + CACHE_TTL_MS };
}

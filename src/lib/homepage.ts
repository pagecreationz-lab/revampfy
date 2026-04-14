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

export async function getHomepageConfig(): Promise<HomepageConfig> {
  try {
    const raw = await fs.readFile(dataPath, "utf8");
    return { ...defaultConfig, ...JSON.parse(raw) } as HomepageConfig;
  } catch {
    return defaultConfig;
  }
}

export async function saveHomepageConfig(config: HomepageConfig): Promise<void> {
  await fs.mkdir(path.dirname(dataPath), { recursive: true });
  await fs.writeFile(dataPath, JSON.stringify(config, null, 2), "utf8");
}

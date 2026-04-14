import "server-only";
import fs from "fs/promises";
import path from "path";
import {
  type SiteContent,
  type SitePageBlock,
  type SitePageKey,
  getDefaultPageBuilder,
} from "@/lib/siteContentSchema";

const PAGE_KEYS: SitePageKey[] = [
  "homePage",
  "aboutUsPage",
  "partnersPage",
  "storesPage",
  "contactUsPage",
  "bulkOrdersPage",
  "companyPage",
  "policiesPage",
];

const defaultContent: SiteContent = {
  themeMode: "dark",
  home: {
    title: "Enterprise-grade refurbished PCs without enterprise prices.",
    subtitle:
      "We supply certified laptops, desktops, and accessories for students, startups, and large-scale deployments with warranty, quality checks, and fast dispatch.",
    heroImageUrl:
      "https://images.unsplash.com/photo-1498050108023-c5249f4df085?q=80&w=900&auto=format&fit=crop",
    programsImageUrl:
      "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?q=80&w=1100&auto=format&fit=crop",
  },
  contactUs: "support@revampfy.in | +91 8248003564",
  aboutUs: "Revampfy delivers quality refurbished devices for schools, startups, and enterprises.",
  partners: "Campus and reseller partner programs available across India.",
  storeLocator: "Online-first support with assisted delivery in major cities.",
  pageBuilder: getDefaultPageBuilder({
    homeTitle: "Enterprise-grade refurbished PCs without enterprise prices.",
    homeSubtitle:
      "We supply certified laptops, desktops, and accessories for students, startups, and large-scale deployments with warranty, quality checks, and fast dispatch.",
    aboutUs:
      "Revampfy delivers quality refurbished devices for schools, startups, and enterprises.",
    partners: "Campus and reseller partner programs available across India.",
    storeLocator: "Online-first support with assisted delivery in major cities.",
    contactUs: "support@revampfy.in | +91 8248003564",
  }),
};

const contentPath = path.join(process.cwd(), "data", "site-content.json");

export async function getSiteContent(): Promise<SiteContent> {
  try {
    const raw = await fs.readFile(contentPath, "utf8");
    const parsed = JSON.parse(raw);
    const parsedBuilder = parsed?.pageBuilder || {};
    const mergedBuilder = PAGE_KEYS.reduce((acc, key) => {
      const candidate = parsedBuilder?.[key];
      acc[key] = Array.isArray(candidate)
        ? (candidate as SitePageBlock[])
        : defaultContent.pageBuilder[key];
      return acc;
    }, {} as Record<SitePageKey, SitePageBlock[]>);

    return {
      ...defaultContent,
      ...parsed,
      themeMode: parsed?.themeMode === "light" ? "light" : "dark",
      home: {
        ...defaultContent.home,
        ...(parsed.home || {}),
      },
      pageBuilder: mergedBuilder,
    } as SiteContent;
  } catch {
    return defaultContent;
  }
}

export async function saveSiteContent(content: SiteContent): Promise<void> {
  await fs.mkdir(path.dirname(contentPath), { recursive: true });
  await fs.writeFile(contentPath, JSON.stringify(content, null, 2), "utf8");
}

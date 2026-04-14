import { getSiteContent, saveSiteContent } from "@/lib/siteContent";
import { revalidatePath } from "next/cache";
import {
  type SiteBuilderItem,
  type SiteBlockTheme,
  type SiteBlockType,
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

export const dynamic = "force-dynamic";

function cleanString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function cleanItems(items: any): SiteBuilderItem[] {
  if (!Array.isArray(items)) return [];
  return items.map((item, index) => ({
    id:
      typeof item?.id === "string" && item.id.trim()
        ? item.id.trim()
        : `item-${Date.now()}-${index}`,
    title: cleanString(item?.title),
    description: cleanString(item?.description),
  }));
}

function cleanBlock(block: any, index: number): SitePageBlock {
  const rawType = cleanString(block?.type);
  const type: SiteBlockType = rawType === "featureGrid" || rawType === "hero" ? rawType : "text";
  const rawTheme = cleanString(block?.theme);
  const theme: SiteBlockTheme = rawTheme === "light" ? "light" : "dark";

  return {
    id:
      typeof block?.id === "string" && block.id.trim()
        ? block.id.trim()
        : `block-${Date.now()}-${index}`,
    type,
    theme,
    eyebrow: cleanString(block?.eyebrow),
    title: cleanString(block?.title),
    content: cleanString(block?.content),
    ctaLabel: cleanString(block?.ctaLabel),
    ctaHref: cleanString(block?.ctaHref),
    items: cleanItems(block?.items),
  };
}

export async function GET() {
  const content = await getSiteContent();
  return Response.json({ content });
}

export async function POST(request: Request) {
  const payload = await request.json();
  const fallbackBuilder = getDefaultPageBuilder({
    homeTitle: payload?.home?.title || "",
    homeSubtitle: payload?.home?.subtitle || "",
    aboutUs: payload?.aboutUs || "",
    partners: payload?.partners || "",
    storeLocator: payload?.storeLocator || "",
    contactUs: payload?.contactUs || "",
  });

  const payloadBuilder = payload?.pageBuilder || {};
  const pageBuilder = PAGE_KEYS.reduce((acc, key) => {
    const blocks = payloadBuilder?.[key];
    acc[key] = Array.isArray(blocks)
      ? blocks.map((block, index) => cleanBlock(block, index))
      : fallbackBuilder[key];
    return acc;
  }, {} as Record<SitePageKey, SitePageBlock[]>);

  const homeTitle = payload?.home?.title || "";
  const homeSubtitle = payload?.home?.subtitle || "";
  const homeBlocks = [...(pageBuilder.homePage || [])];
  const homeHeroIndex = homeBlocks.findIndex((block) => block.type === "hero");
  if (homeHeroIndex >= 0) {
    homeBlocks[homeHeroIndex] = {
      ...homeBlocks[homeHeroIndex],
      title: homeTitle || homeBlocks[homeHeroIndex].title,
      content: homeSubtitle || homeBlocks[homeHeroIndex].content,
    };
  } else {
    homeBlocks.unshift({
      id: `home-hero-${Date.now()}`,
      type: "hero",
      theme: "dark",
      eyebrow: "Revampfy",
      title: homeTitle,
      content: homeSubtitle,
      ctaLabel: "Shop Deals",
      ctaHref: "/#deals",
      items: [],
    });
  }
  pageBuilder.homePage = homeBlocks;

  const content: SiteContent = {
    themeMode: payload?.themeMode === "light" ? "light" : "dark",
    home: {
      title: payload?.home?.title || "",
      subtitle: payload?.home?.subtitle || "",
      heroImageUrl: payload?.home?.heroImageUrl || "",
      programsImageUrl: payload?.home?.programsImageUrl || "",
    },
    contactUs: payload?.contactUs || "",
    aboutUs: payload?.aboutUs || "",
    partners: payload?.partners || "",
    storeLocator: payload?.storeLocator || "",
    pageBuilder,
  };

  await saveSiteContent(content);
  revalidatePath("/");
  revalidatePath("/about-us");
  revalidatePath("/partners");
  revalidatePath("/stores");
  revalidatePath("/contact-us");
  revalidatePath("/bulk-orders-enquiry");
  revalidatePath("/company");
  revalidatePath("/policies");
  return Response.json({ content });
}

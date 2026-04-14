import { getHomepageConfig, saveHomepageConfig } from "@/lib/homepage";

export async function GET() {
  const config = await getHomepageConfig();
  return Response.json({ config });
}

export async function POST(request: Request) {
  const payload = await request.json();
  const config = {
    categoryCollectionHandles: Array.isArray(payload.categoryCollectionHandles)
      ? payload.categoryCollectionHandles
      : [],
    featuredBrands: Array.isArray(payload.featuredBrands)
      ? payload.featuredBrands
      : [],
    featuredVendors: Array.isArray(payload.featuredVendors)
      ? payload.featuredVendors
      : [],
    studentsProductIds: Array.isArray(payload.studentsProductIds)
      ? payload.studentsProductIds.map(Number).filter((id: number) => !Number.isNaN(id))
      : [],
    topSellingProductIds: Array.isArray(payload.topSellingProductIds)
      ? payload.topSellingProductIds.map(Number).filter((id: number) => !Number.isNaN(id))
      : [],
  };

  await saveHomepageConfig(config);
  return Response.json({ config });
}

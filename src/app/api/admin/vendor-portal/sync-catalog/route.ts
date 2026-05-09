import { NextResponse } from "next/server";
import { getCatalogSyncPayload } from "@/lib/catalog";

export async function POST() {
  try {
    const payload = await getCatalogSyncPayload();
    return NextResponse.json({
      ok: true,
      message: "Vendor catalog is synced from CMS data.",
      counts: {
        products: payload.products.length,
        categories: payload.categories.length,
        brands: payload.brands.length,
        vendors: payload.vendors.length,
      },
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to sync vendor catalog.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

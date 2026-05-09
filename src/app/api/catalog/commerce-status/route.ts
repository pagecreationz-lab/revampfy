import { getEffectiveCatalogSyncStore } from "@/lib/catalogSyncRuntime";
import { getCatalogCommerceConfig } from "@/lib/catalogCommerce";

export async function GET() {
  try {
    const [syncStore, config] = await Promise.all([
      getEffectiveCatalogSyncStore().catch(() => null),
      getCatalogCommerceConfig(),
    ]);

    const products = syncStore?.payload?.products || [];
    const categories = syncStore?.payload?.categories || [];
    const inventoryUnits = products.reduce(
      (sum, product) =>
        sum +
        (product.variants || []).reduce(
          (inner, variant) => inner + Number(variant.inventory_quantity || 0),
          0
        ),
      0
    );

    return Response.json({
      config,
      syncedAt: syncStore?.syncedAt || "",
      metrics: {
        categories: categories.length,
        products: products.length,
        inventoryUnits,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to compute commerce status.";
    return Response.json({ error: message }, { status: 500 });
  }
}

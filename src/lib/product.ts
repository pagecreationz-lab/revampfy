import type { ShopifyProduct } from "@/lib/shopify";

export type ResolvedVariant = NonNullable<ShopifyProduct["variants"]>[number] & {
  id: number;
};

export function resolveVariantsFromProduct(
  product: ShopifyProduct,
  liveProduct?: ShopifyProduct
): ResolvedVariant[] {
  const source = liveProduct || product;
  const sourceVariants = source.variants || [];
  const fallbackVariants = product.variants || [];

  return sourceVariants
    .map((variant, index) => {
      const sourceId = typeof variant.id === "number" ? variant.id : undefined;
      const fallback = fallbackVariants[index];
      const fallbackId = typeof fallback?.id === "number" ? fallback.id : undefined;
      const variantId = sourceId || fallbackId;
      if (!variantId) return null;
      return {
        ...variant,
        id: variantId,
        title: variant.title || fallback?.title || `Variant ${index + 1}`,
        inventory_quantity: variant.inventory_quantity ?? fallback?.inventory_quantity ?? 0,
        requires_shipping: variant.requires_shipping ?? fallback?.requires_shipping ?? false,
      } as ResolvedVariant;
    })
    .filter((variant): variant is ResolvedVariant => Boolean(variant));
}

export function getPrimaryCategory(product: ShopifyProduct) {
  return (product.category || product.product_type || "General").trim();
}

export function getProductStockQty(product: ShopifyProduct) {
  return (
    product.variants?.reduce(
      (sum, variant) => sum + Number(variant.inventory_quantity || 0),
      0
    ) || 0
  );
}

export function getProductPrices(product: ShopifyProduct) {
  return (product.variants || [])
    .map((variant) => Number(variant.price))
    .filter((value) => Number.isFinite(value));
}


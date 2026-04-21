import { cookies } from "next/headers";
import { Header } from "@/components/Header";
import { Topbar } from "@/components/Topbar";
import { verifySessionToken } from "@/lib/auth";
import { getEffectiveShopifySyncStore } from "@/lib/shopifySyncRuntime";
import { getProductById } from "@/lib/shopify";
import type { ShopifyProduct } from "@/lib/shopify";
import { ProductDetailClient } from "@/components/ProductDetailClient";

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const cookieStore = await cookies();
  const token = cookieStore.get("pcgs_admin_session")?.value;
  const session = verifySessionToken(token);
  const resolved = await params;
  const productId = Number(resolved.id);

  const liveProduct = await getProductById(productId).catch(() => null);
  let product: ShopifyProduct | null = liveProduct;

  if (!product) {
    const synced = await getEffectiveShopifySyncStore().catch(() => null);
    const products: ShopifyProduct[] = synced?.payload?.products || [];
    product = products.find((item) => item.id === productId) || null;
  }

  return (
    <>
      <Topbar />
      <Header />
      <main>
        <ProductDetailClient product={product} isAuthenticated={Boolean(session)} />
      </main>
    </>
  );
}

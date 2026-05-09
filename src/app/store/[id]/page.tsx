import { Header } from "@/components/Header";
import { Topbar } from "@/components/Topbar";
import { getProductById } from "@/lib/catalog";
import type { CatalogProduct } from "@/lib/catalog";
import { ProductDetailClient } from "@/components/ProductDetailClient";

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = await params;
  const productId = resolvedParams?.id;

  const liveProduct = await getProductById(productId).catch(() => null);
  const product: CatalogProduct | null = liveProduct;

  return (
    <>
      <Topbar />
      <Header />
      <main>
        <ProductDetailClient product={product} isAuthenticated={false} />
      </main>
    </>
  );
}

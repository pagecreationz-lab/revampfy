import { Suspense } from "react";
import { Header } from "@/components/Header";
import { Topbar } from "@/components/Topbar";
import { StoreClient } from "@/components/StoreClient";
import { getCollections, getProducts, type CatalogCollection, type CatalogProduct } from "@/lib/catalog";

export const revalidate = 60;

export default async function StorePage() {
  const [productsRes, collectionsAll] = await Promise.all([
    getProducts({ limit: 250, status: "any", vendorManagedOnly: true }).catch(() => ({ products: [] as CatalogProduct[] })),
    getCollections().catch(() => [] as CatalogCollection[]),
  ]);
  const products: CatalogProduct[] = productsRes.products || [];
  const handleSet = new Set(
    products.flatMap((product) => (product.collection_handles || []).map((handle) => handle.trim()).filter(Boolean))
  );
  const collections: CatalogCollection[] = collectionsAll.filter((collection) => handleSet.has(collection.handle));

  return (
    <>
      <Topbar />
      <Header />
      <main>
        <section className="section">
          <div className="container">
            <Suspense fallback={null}>
              <StoreClient products={products} collections={collections} />
            </Suspense>
          </div>
        </section>
      </main>
    </>
  );
}


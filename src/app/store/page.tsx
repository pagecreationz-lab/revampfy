import { Suspense } from "react";
import { Header } from "@/components/Header";
import { Topbar } from "@/components/Topbar";
import { StoreClient } from "@/components/StoreClient";
import { CommerceStatusPanel } from "@/components/CommerceStatusPanel";
import { getEffectiveShopifySyncStore } from "@/lib/shopifySyncRuntime";
import type { ShopifyCollection, ShopifyProduct } from "@/lib/shopify";

export default async function StorePage() {
  const synced = await getEffectiveShopifySyncStore().catch(() => null);
  const products: ShopifyProduct[] = synced?.payload?.products || [];
  const collections: ShopifyCollection[] = synced?.payload?.categories || [];

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
        <CommerceStatusPanel />
      </main>
    </>
  );
}

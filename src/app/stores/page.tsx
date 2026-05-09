import { Header } from "@/components/Header";
import { Topbar } from "@/components/Topbar";
import { SitePageBuilderRenderer } from "@/components/SitePageBuilderRenderer";
import { StateStoreLocator } from "@/components/StateStoreLocator";
import { getSiteContent } from "@/lib/siteContent";

export const dynamic = "force-dynamic";

export default async function StoresPage() {
  const content = await getSiteContent();

  return (
    <>
      <Topbar />
      <Header />
      <main>
        <SitePageBuilderRenderer blocks={content.pageBuilder.storesPage} />
        <StateStoreLocator />
      </main>
    </>
  );
}

import { Header } from "@/components/Header";
import { Topbar } from "@/components/Topbar";
import { EnquiryForm } from "@/components/EnquiryForm";
import { SitePageBuilderRenderer } from "@/components/SitePageBuilderRenderer";
import { getSiteContent } from "@/lib/siteContent";

export const dynamic = "force-dynamic";

export default async function BulkOrdersEnquiryPage() {
  const content = await getSiteContent();

  return (
    <>
      <Topbar />
      <Header />

      <main>
        <SitePageBuilderRenderer blocks={content.pageBuilder.bulkOrdersPage} />

        <section className="section">
          <div className="container info-media-section">
            <div className="info-media-section__content">
              <p className="eyebrow">Bulk Orders</p>
              <h2>Scale device rollouts with confidence</h2>
              <p>
                From schools to corporate deployments, we support large-volume
                orders with fast dispatch, verified quality, and dedicated
                post-sales assistance.
              </p>
            </div>
            <div className="info-media-section__image">
              <img
                src="https://images.unsplash.com/photo-1580894732444-8ecded7900cd?q=80&w=1400&auto=format&fit=crop"
                alt="Bulk laptop order packaging and logistics"
              />
            </div>
          </div>
        </section>

        <section className="section section--alt">
          <div className="container">
            <EnquiryForm mode="bulk" />
          </div>
        </section>
      </main>
    </>
  );
}

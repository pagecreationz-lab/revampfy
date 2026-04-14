import { Header } from "@/components/Header";
import { Topbar } from "@/components/Topbar";
import { SitePageBuilderRenderer } from "@/components/SitePageBuilderRenderer";
import { getSiteContent } from "@/lib/siteContent";

export const dynamic = "force-dynamic";

export default async function AboutUsPage() {
  const content = await getSiteContent();

  return (
    <>
      <Topbar />
      <Header />
      <main>
        <SitePageBuilderRenderer blocks={content.pageBuilder.aboutUsPage} />

        <section className="section">
          <div className="container info-media-section">
            <div className="info-media-section__content">
              <p className="eyebrow">About Revampfy</p>
              <h2>Built for reliable refurbished technology</h2>
              <p>
                We refurbish and test every system with strict quality checks so
                students, startups, and businesses get dependable performance at
                a better value.
              </p>
            </div>
            <div className="info-media-section__image">
              <img
                src="https://images.unsplash.com/photo-1517336714731-489689fd1ca8?q=80&w=1400&auto=format&fit=crop"
                alt="Refurbished laptop quality check setup"
              />
            </div>
          </div>
        </section>
      </main>
    </>
  );
}

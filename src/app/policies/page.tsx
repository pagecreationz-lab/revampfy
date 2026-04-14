import { Header } from "@/components/Header";
import { Topbar } from "@/components/Topbar";
import { SitePageBuilderRenderer } from "@/components/SitePageBuilderRenderer";
import { getSiteContent } from "@/lib/siteContent";
import { getShopifyCommerceConfig } from "@/lib/shopifyCommerce";

export const dynamic = "force-dynamic";

export default async function PoliciesPage() {
  const [content, commerceConfig] = await Promise.all([
    getSiteContent(),
    getShopifyCommerceConfig(),
  ]);

  return (
    <>
      <Topbar />
      <Header />
      <main>
        <SitePageBuilderRenderer blocks={content.pageBuilder.policiesPage} />
        {commerceConfig.enableCustomerPolicy ? (
          <section className="section">
            <div className="container">
              <div className="admin__panel">
                <h2>Customer Policies</h2>
                <div className="admin__grid">
                  <div className="admin__item">
                    <strong>Shipping Policy</strong>
                    <small>{commerceConfig.shippingPolicy}</small>
                  </div>
                  <div className="admin__item">
                    <strong>Returns Policy</strong>
                    <small>{commerceConfig.returnsPolicy}</small>
                  </div>
                  <div className="admin__item">
                    <strong>Warranty Policy</strong>
                    <small>{commerceConfig.warrantyPolicy}</small>
                  </div>
                  <div className="admin__item">
                    <strong>Privacy Policy</strong>
                    <small>{commerceConfig.privacyPolicy}</small>
                  </div>
                </div>
              </div>
            </div>
          </section>
        ) : null}
      </main>
    </>
  );
}

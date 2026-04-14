import { Header } from "@/components/Header";
import { Topbar } from "@/components/Topbar";
import { EnquiryForm } from "@/components/EnquiryForm";
import { SitePageBuilderRenderer } from "@/components/SitePageBuilderRenderer";
import { getSiteContent } from "@/lib/siteContent";

export const dynamic = "force-dynamic";

export default async function ContactUsPage() {
  const content = await getSiteContent();

  return (
    <>
      <Topbar />
      <Header />

      <main>
        <SitePageBuilderRenderer blocks={content.pageBuilder.contactUsPage} />

        <section className="section">
          <div className="container info-media-section">
            <div className="info-media-section__content">
              <p className="eyebrow">Contact Revampfy</p>
              <h2>Visit or reach us directly</h2>
              <p>
                <strong>Address:</strong> 96 south east maheshwari nagar, 4th
                Cross St, Maheshwar Nagar, Sithalapakkam, Chennai, Tamil Nadu
                600126
              </p>
              <p>
                <strong>Mobile:</strong> +91 8248003564
              </p>
            </div>
            <div className="info-media-section__image">
              <img
                src="https://images.unsplash.com/photo-1497215728101-856f4ea42174?q=80&w=1400&auto=format&fit=crop"
                alt="Office workspace for customer support"
              />
            </div>
          </div>
        </section>

        <section className="section section--alt">
          <div className="container">
            <div className="contact-map-embed">
              <iframe
                src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d31115.608032962253!2d80.1714713!3d12.878695499999997!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x3a52595e42ea3fbd%3A0xfac464326fa31d03!2sPCGS%20ENTERPRISES!5e0!3m2!1sen!2sin!4v1776110030818!5m2!1sen!2sin"
                width="600"
                height="450"
                style={{ border: 0 }}
                allowFullScreen
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                title="PCGS Enterprises Map Location"
              />
            </div>
          </div>
        </section>

        <section className="section">
          <div className="container">
            <EnquiryForm mode="contact" />
          </div>
        </section>
      </main>
    </>
  );
}

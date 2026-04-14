"use client";

import { useState } from "react";
import type { SitePageBlock, SiteBuilderItem } from "@/lib/siteContentSchema";

const REMOTE_SUPPORT_WHATSAPP =
  "https://wa.me/918248003564?text=Hi%20Revampfy%2C%20I%20need%20help%20with%20remote%20store%20support.";

export function SitePageBuilderRenderer({ blocks }: { blocks: SitePageBlock[] }) {
  const [showChennaiHubPopup, setShowChennaiHubPopup] = useState(false);

  if (!blocks?.length) return null;

  const renderFeatureGridItem = (item: SiteBuilderItem) => {
    const normalizedTitle = item.title.trim().toLowerCase();
    const isChennaiHub = normalizedTitle === "chennai hub";
    const isRemoteSupport = normalizedTitle === "remote support";

    if (isChennaiHub) {
      return (
        <button
          type="button"
          className="info-card info-card--link"
          key={item.id}
          onClick={() => setShowChennaiHubPopup(true)}
        >
          <h3>{item.title}</h3>
          <p>{item.description}</p>
        </button>
      );
    }

    if (isRemoteSupport) {
      return (
        <button
          type="button"
          className="info-card info-card--link"
          key={item.id}
          onClick={() => {
            window.open(REMOTE_SUPPORT_WHATSAPP, "_blank", "noopener,noreferrer");
          }}
        >
          <h3>{item.title}</h3>
          <p>{item.description}</p>
        </button>
      );
    }

    return (
      <article className="info-card" key={item.id}>
        <h3>{item.title}</h3>
        <p>{item.description}</p>
      </article>
    );
  };

  return (
    <>
      {blocks.map((block) => {
        const sectionClass =
          block.theme === "light" ? "section" : "section section--alt";

        if (block.type === "featureGrid") {
          return (
            <section className={sectionClass} key={block.id}>
              <div className="container info-page">
                {block.eyebrow ? <p className="eyebrow">{block.eyebrow}</p> : null}
                {block.title ? <h2>{block.title}</h2> : null}
                {block.content ? <p>{block.content}</p> : null}
                <div className="info-page__grid">
                  {(block.items || []).map((item) => renderFeatureGridItem(item))}
                </div>
              </div>
            </section>
          );
        }

        return (
          <section className={sectionClass} key={block.id}>
            <div className="container info-page">
              {block.eyebrow ? <p className="eyebrow">{block.eyebrow}</p> : null}
              {block.title ? <h1>{block.title}</h1> : null}
              {block.content ? <p>{block.content}</p> : null}
              {block.ctaLabel && block.ctaHref ? (
                <div className="hero__cta">
                  <a href={block.ctaHref}>
                    <button className="primary">{block.ctaLabel}</button>
                  </a>
                </div>
              ) : null}
            </div>
          </section>
        );
      })}

      {showChennaiHubPopup ? (
        <div
          className="quick-view-modal"
          role="dialog"
          aria-modal="true"
          aria-label="Chennai Hub store details"
          onClick={() => setShowChennaiHubPopup(false)}
        >
          <div
            className="quick-view-modal__card quick-view-modal__card--warning"
            onClick={(event) => event.stopPropagation()}
          >
            <h3>Chennai Hub</h3>
            <p>
              <strong>PCGS ENTERPRISES</strong>
            </p>
            <p>
              96 south east maheshwari nagar, 4th Cross St, Maheshwar Nagar, Sithalapakkam,
              Chennai, Tamil Nadu 600126
            </p>
            <p>
              <strong>Revampfy Store</strong>
            </p>
            <p>
              96 south east maheshwari nagar, 4th Cross St, Maheshwar Nagar, Sithalapakkam,
              Chennai, Tamil Nadu 600126
            </p>
            <div className="product__actions">
              <button
                type="button"
                className="product-action-btn product-action-btn--compare"
                onClick={() => setShowChennaiHubPopup(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

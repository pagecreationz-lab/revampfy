"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { canEmbedInvoiceUrl, isAllowedInvoiceUrl } from "@/lib/payment";

export function PaymentClient() {
  const params = useSearchParams();
  const [iframeFailed, setIframeFailed] = useState(false);
  const invoice = params.get("invoice") || "";

  const validInvoiceUrl = useMemo(() => {
    if (!isAllowedInvoiceUrl(invoice)) return "";
    return invoice;
  }, [invoice]);
  const canEmbed = useMemo(() => canEmbedInvoiceUrl(validInvoiceUrl), [validInvoiceUrl]);

  useEffect(() => {
    if (!validInvoiceUrl || canEmbed || typeof window === "undefined") return;
    const timer = window.setTimeout(() => {
      window.location.href = validInvoiceUrl;
    }, 450);
    return () => window.clearTimeout(timer);
  }, [validInvoiceUrl, canEmbed]);

  if (!validInvoiceUrl) {
    return (
      <section className="section">
        <div className="container">
          <div className="admin__panel">
            <h1>Payment</h1>
            <p className="hero__subtext">Invalid or missing payment link.</p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="section">
      <div className="container">
        <div className="admin__panel payment-page">
          <div className="payment-page__head">
            <h1>Complete Payment</h1>
            <a href={validInvoiceUrl} target="_blank" rel="noreferrer">
              <button className="secondary" type="button">
                Open in New Tab
              </button>
            </a>
          </div>
          <p className="hero__subtext">
            Payment is shown inside frontend. If blocked by Shopify browser policy, use &quot;Open
            in New Tab&quot;.
          </p>
          {canEmbed && !iframeFailed ? (
            <iframe
              className="payment-page__iframe"
              src={validInvoiceUrl}
              title="Payment Invoice"
              onError={() => setIframeFailed(true)}
            />
          ) : (
            <>
              <div className="admin__alert admin__alert--info">
                Opening secure payment page...
              </div>
              <div className="payment-page__actions">
                <a href={validInvoiceUrl}>
                  <button className="primary" type="button">
                    Continue to Secure Payment
                  </button>
                </a>
                <a href={validInvoiceUrl} target="_blank" rel="noreferrer">
                  <button className="secondary" type="button">
                    Open in New Tab
                  </button>
                </a>
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  );
}

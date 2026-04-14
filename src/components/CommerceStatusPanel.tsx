"use client";

import { useEffect, useState } from "react";

type Capability = {
  key: string;
  label: string;
  enabledInCms: boolean;
  live: boolean;
  detail: string;
};

type CommerceStatusResponse = {
  syncedAt?: string;
  schedulerMode?: "manual" | "hourly";
  capabilities?: Capability[];
  policies?: {
    shipping?: string;
    returns?: string;
    warranty?: string;
    privacy?: string;
  };
  metrics?: {
    categories: number;
    products: number;
    inventoryUnits: number;
    lowStockCount: number;
    outOfStockCount: number;
    sampleCustomers: number;
  };
  error?: string;
};

export function CommerceStatusPanel() {
  const [data, setData] = useState<CommerceStatusResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/shopify/commerce-status");
        const json = (await res.json()) as CommerceStatusResponse;
        setData(json);
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, []);

  return (
    <section className="section">
      <div className="container">
        <div className="admin__panel commerce-status-panel">
          <h2>Shopify Commerce Modules</h2>
          <p className="hero__subtext">
            Payments, checkout, customers, shipping, taxes, inventory, notifications, policy, and 2-way sync.
          </p>
          {loading ? <p className="hero__subtext">Loading commerce status...</p> : null}
          {!loading && data?.error ? (
            <div className="admin__alert admin__alert--error">{data.error}</div>
          ) : null}
          {!loading && data?.capabilities?.length ? (
            <>
              <div className="admin__grid">
                {data.capabilities.map((capability) => (
                  <div className="admin__item" key={capability.key}>
                    <strong>{capability.label}</strong>
                    <small>
                      CMS: {capability.enabledInCms ? "Enabled" : "Disabled"} | Live:{" "}
                      {capability.live ? "Active" : "Not active"}
                    </small>
                    <small>{capability.detail}</small>
                  </div>
                ))}
              </div>
              {data.metrics ? (
                <p className="hero__subtext" style={{ marginTop: "0.8rem" }}>
                  Products: {data.metrics.products} | Inventory units: {data.metrics.inventoryUnits} | Low stock:{" "}
                  {data.metrics.lowStockCount} | Out of stock: {data.metrics.outOfStockCount} | Last sync:{" "}
                  {data.syncedAt ? new Date(data.syncedAt).toLocaleString() : "Never"} | Scheduler:{" "}
                  {data.schedulerMode || "manual"}
                </p>
              ) : null}
              {data.policies ? (
                <div className="admin__grid" style={{ marginTop: "0.8rem" }}>
                  <div className="admin__item">
                    <strong>Shipping policy</strong>
                    <small>{data.policies.shipping || "Not set"}</small>
                  </div>
                  <div className="admin__item">
                    <strong>Returns policy</strong>
                    <small>{data.policies.returns || "Not set"}</small>
                  </div>
                  <div className="admin__item">
                    <strong>Warranty policy</strong>
                    <small>{data.policies.warranty || "Not set"}</small>
                  </div>
                  <div className="admin__item">
                    <strong>Privacy policy</strong>
                    <small>{data.policies.privacy || "Not set"}</small>
                  </div>
                </div>
              ) : null}
            </>
          ) : null}
        </div>
      </div>
    </section>
  );
}

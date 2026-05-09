"use client";

import { useEffect, useMemo, useState } from "react";
import { readJsonSafe } from "@/lib/httpClient";

type Store = {
  id: string;
  vendorId: string;
  vendorName?: string;
  state: string;
  city: string;
  storeName: string;
  address: string;
  phone: string;
  pincode: string;
  isActive: boolean;
};

export function StateStoreLocator() {
  const [allStores, setAllStores] = useState<Store[]>([]);
  const [state, setState] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const load = async () => {
      const res = await fetch("/api/vendors/stores");
      const json = await readJsonSafe(res);
      if (!res.ok || json.error) {
        setError(json.error || "Unable to load stores.");
        return;
      }
      setAllStores(json.stores || []);
    };
    void load();
  }, []);

  const states = useMemo(
    () => Array.from(new Set(allStores.map((store) => store.state).filter(Boolean))).sort((a, b) => a.localeCompare(b)),
    [allStores]
  );

  const filtered = useMemo(
    () => allStores.filter((store) => !state || store.state.toLowerCase() === state.toLowerCase()),
    [allStores, state]
  );

  return (
    <section className="container" style={{ padding: "1rem" }}>
      <div className="admin__panel">
        <h2>State-Based Store Locator</h2>
        <p className="hero__subtext">Find vendor stores by state. Data is synced through CMS admin.</p>
        <div style={{ maxWidth: 360, marginBottom: "1rem" }}>
          <select value={state} onChange={(e) => setState(e.target.value)}>
            <option value="">All states</option>
            {states.map((item) => (
              <option key={item} value={item}>{item}</option>
            ))}
          </select>
        </div>
        {error ? <p style={{ color: "#b73333" }}>{error}</p> : null}
        <div className="admin__grid admin__grid--four">
          {filtered.length ? (
            filtered.map((store) => (
              <article key={store.id} className="admin__card">
                <h3>{store.storeName}</h3>
                <p><strong>{store.vendorName || "Vendor"}</strong></p>
                <p>{store.city}, {store.state} - {store.pincode || "N/A"}</p>
                <p>{store.address || "No address"}</p>
                <p>{store.phone || "No phone"}</p>
              </article>
            ))
          ) : (
            <p>No stores found for selected state.</p>
          )}
        </div>
      </div>
    </section>
  );
}

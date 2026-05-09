export default function VendorAdminLoading() {
  return (
    <section className="container" style={{ padding: "1.5rem 1rem" }} aria-busy="true" aria-live="polite">
      <p className="hero__subtext">Loading vendor portal...</p>
      <div className="admin__panel">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,minmax(0,1fr))", gap: "0.75rem", marginBottom: "1rem" }}>
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={`vendor-nav-skeleton-${i}`} style={{ height: 48, borderRadius: 12, background: "rgba(148,163,184,0.22)" }} />
          ))}
        </div>
        <div style={{ height: 420, borderRadius: 16, background: "rgba(148,163,184,0.2)" }} />
      </div>
    </section>
  );
}


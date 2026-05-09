export default function AdminOrdersLoading() {
  return (
    <main aria-busy="true" aria-live="polite">
      <h1>Orders</h1>
      <p className="hero__subtext">Loading orders...</p>
      <section className="admin__panel">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,minmax(0,1fr))", gap: "0.75rem", marginBottom: "0.85rem" }}>
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={`orders-filter-skeleton-${i}`} style={{ height: 42, borderRadius: 10, background: "rgba(148,163,184,0.22)" }} />
          ))}
        </div>
        <div style={{ height: 360, borderRadius: 14, background: "rgba(148,163,184,0.2)" }} />
      </section>
    </main>
  );
}


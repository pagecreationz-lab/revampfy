export default function StoreLoading() {
  return (
    <main>
      <section className="section">
        <div className="container">
          <div className="admin__panel" aria-busy="true" aria-live="polite">
            <p className="hero__subtext">Loading store...</p>
            <div style={{ display: "grid", gridTemplateColumns: "280px 1fr", gap: "1rem" }}>
              <div style={{ height: 520, borderRadius: 16, background: "rgba(148,163,184,0.2)" }} />
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3,minmax(0,1fr))", gap: "1rem" }}>
                {Array.from({ length: 6 }).map((_, i) => (
                  <div
                    key={`store-skeleton-${i}`}
                    style={{ height: 280, borderRadius: 16, background: "rgba(148,163,184,0.2)" }}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}


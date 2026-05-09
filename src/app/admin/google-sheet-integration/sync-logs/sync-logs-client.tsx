"use client";

import { useEffect, useMemo, useState } from "react";
import { readJsonSafe } from "@/lib/httpClient";

type Vendor = { id: string; name: string; email: string };
type LogItem = {
  id: string;
  vendorId: string;
  at: string;
  status: "success" | "error";
  message: string;
  productsProcessed: number;
};

export default function SyncLogsAdminClient() {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [logs, setLogs] = useState<LogItem[]>([]);
  const [error, setError] = useState("");

  const vendorNameById = useMemo(
    () => new Map(vendors.map((vendor) => [vendor.id, vendor.name] as const)),
    [vendors]
  );

  useEffect(() => {
    const load = async () => {
      setError("");
      const [vendorRes, logsRes] = await Promise.all([
        fetch("/api/admin/vendor-portal", { cache: "no-store" }),
        fetch("/api/admin/vendor-sheets", { cache: "no-store" }),
      ]);
      const vendorJson = await readJsonSafe(vendorRes);
      const logsJson = await readJsonSafe(logsRes);
      if (!vendorRes.ok || vendorJson?.error) {
        setError(String(vendorJson?.error || "Unable to load vendors."));
        return;
      }
      if (!logsRes.ok || logsJson?.error) {
        setError(String(logsJson?.error || "Unable to load sync logs."));
        return;
      }
      setVendors(Array.isArray(vendorJson?.data?.vendors) ? vendorJson.data.vendors : []);
      setLogs(Array.isArray(logsJson?.logs) ? logsJson.logs : []);
    };
    void load();
  }, []);

  return (
    <section className="admin__panel">
      <div className="vendor-product-card__actions" style={{ marginBottom: "0.8rem" }}>
        <button className="secondary" type="button" onClick={() => (window.location.href = "/admin/google-sheet-integration")}>
          Back To Integration
        </button>
      </div>
      <article className="admin__card">
        <h3>Google Sheet Sync Logs</h3>
        <p style={{ marginTop: "0.45rem" }}>Detailed vendor-wise sync history.</p>
        <div className="admin__table-wrap" style={{ marginTop: "0.75rem", overflowX: "auto" }}>
          <table className="admin__table">
            <thead>
              <tr>
                <th>Vendor</th>
                <th>Date/Time</th>
                <th>Status</th>
                <th>Message</th>
                <th>Products Processed</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id}>
                  <td>{vendorNameById.get(log.vendorId) || log.vendorId}</td>
                  <td>{new Date(log.at).toLocaleString("en-IN")}</td>
                  <td>{log.status}</td>
                  <td>{log.message}</td>
                  <td>{Number(log.productsProcessed || 0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!logs.length ? <p style={{ marginTop: "0.75rem" }}>No sync logs found.</p> : null}
        {error ? <div className="admin__alert admin__alert--error" style={{ marginTop: "0.7rem" }}>{error}</div> : null}
      </article>
    </section>
  );
}


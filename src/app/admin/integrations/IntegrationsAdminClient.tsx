"use client";

import { useEffect, useState } from "react";
import { readJsonSafe } from "@/lib/httpClient";

type Settings = {
  n8n: {
    enabled: boolean;
    baseUrl: string;
    apiKey: string;
    webhookUrl: string;
  };
  googleSheets: {
    enabled: boolean;
    clientId: string;
    clientSecret: string;
    redirectUri: string;
    sheetUrl: string;
    spreadsheetId: string;
    sheetName: string;
    connectedEmail: string;
    autoSyncEnabled: boolean;
    syncIntervalMinutes: number;
    webhookSecret: string;
    lastSyncAt: string;
    lastSyncStatus: "idle" | "success" | "error";
    lastSyncMessage: string;
  };
};
type SyncLog = {
  id: string;
  at: string;
  status: "success" | "error";
  message: string;
  vendorsProcessed: number;
  productsProcessed: number;
};

const empty: Settings = {
  n8n: { enabled: false, baseUrl: "", apiKey: "", webhookUrl: "" },
  googleSheets: {
    enabled: false,
    clientId: "",
    clientSecret: "",
    redirectUri: "",
    sheetUrl: "",
    spreadsheetId: "",
    sheetName: "Sheet1",
    connectedEmail: "",
    autoSyncEnabled: false,
    syncIntervalMinutes: 5,
    webhookSecret: "",
    lastSyncAt: "",
    lastSyncStatus: "idle",
    lastSyncMessage: "",
  },
};

export default function IntegrationsAdminClient() {
  const [settings, setSettings] = useState<Settings>(empty);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [testing, setTesting] = useState(false);
  const [syncingSheets, setSyncingSheets] = useState(false);
  const [testingSheets, setTestingSheets] = useState(false);
  const [logs, setLogs] = useState<SyncLog[]>([]);

  const load = async () => {
    setError("");
    const res = await fetch("/api/admin/integrations", { cache: "no-store" });
    const json = await readJsonSafe(res);
    if (!res.ok || json?.error) {
      setError(String(json?.error || "Unable to load integration settings."));
      return;
    }
    setSettings((json?.settings || empty) as Settings);
    setLogs(Array.isArray(json?.logs) ? (json.logs as SyncLog[]) : []);
  };

  const syncGoogleSheetsNow = async () => {
    setSyncingSheets(true);
    setError("");
    setStatus("");
    try {
      const res = await fetch("/api/admin/vendor-portal/google-sheets-import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sheetName: settings.googleSheets.sheetName || "Sheet1" }),
      });
      const json = await readJsonSafe(res);
      if (!res.ok || json?.error) {
        setError(String(json?.error || "Google Sheets sync failed."));
        return;
      }
      setStatus(String(json?.message || "Google Sheets sync completed."));
      await load();
    } finally {
      setSyncingSheets(false);
    }
  };

  const testGoogleSheets = async () => {
    setTestingSheets(true);
    setError("");
    setStatus("");
    try {
      const res = await fetch("/api/admin/integrations/google-sheets/test", { method: "POST" });
      const json = await readJsonSafe(res);
      if (!res.ok || json?.error) {
        setError(String(json?.error || "Google Sheets test failed."));
        return;
      }
      setStatus(String(json?.message || "Google Sheets connected."));
    } finally {
      setTestingSheets(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const save = async () => {
    setStatus("");
    setError("");
    const res = await fetch("/api/admin/integrations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(settings),
    });
    const json = await readJsonSafe(res);
    if (!res.ok || json?.error) {
      setError(String(json?.error || "Unable to save integration settings."));
      return;
    }
    setSettings((json?.settings || empty) as Settings);
    setStatus("Integration settings saved.");
  };

  const testN8n = async () => {
    setTesting(true);
    setError("");
    setStatus("");
    try {
      const res = await fetch("/api/admin/integrations/n8n/test", { method: "POST" });
      const json = await readJsonSafe(res);
      if (!res.ok || json?.error) {
        setError(String(json?.error || "n8n test failed."));
        return;
      }
      setStatus(`n8n test: HTTP ${json?.status ?? "unknown"} at ${json?.endpoint || ""}`);
    } finally {
      setTesting(false);
    }
  };

  return (
    <section className="admin__panel">
      {status ? <div className="admin__alert admin__alert--success">{status}</div> : null}
      {error ? <div className="admin__alert admin__alert--error">{error}</div> : null}

      <div className="admin__grid admin__grid--four">
        <article className="admin__card" style={{ gridColumn: "span 2" }}>
          <h3>n8n API Integration</h3>
          <div className="admin__form" style={{ marginTop: "0.75rem" }}>
            <label style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
              <input
                type="checkbox"
                checked={settings.n8n.enabled}
                onChange={(e) => setSettings((p) => ({ ...p, n8n: { ...p.n8n, enabled: e.target.checked } }))}
              />
              Enable n8n integration
            </label>
            <input
              value={settings.n8n.baseUrl}
              onChange={(e) => setSettings((p) => ({ ...p, n8n: { ...p.n8n, baseUrl: e.target.value } }))}
              placeholder="n8n Base URL (e.g. https://n8n.example.com)"
            />
            <input
              value={settings.n8n.apiKey}
              onChange={(e) => setSettings((p) => ({ ...p, n8n: { ...p.n8n, apiKey: e.target.value } }))}
              placeholder="n8n API Key"
            />
            <input
              value={settings.n8n.webhookUrl}
              onChange={(e) => setSettings((p) => ({ ...p, n8n: { ...p.n8n, webhookUrl: e.target.value } }))}
              placeholder="Default n8n Webhook URL (optional)"
            />
            <div className="vendor-product-card__actions">
              <button type="button" className="secondary" onClick={save}>
                Save
              </button>
              <button type="button" className="ghost" disabled={testing} onClick={testN8n}>
                {testing ? "Testing..." : "Test n8n"}
              </button>
            </div>
          </div>
        </article>

        {/*<article className="admin__card" style={{ gridColumn: "span 2" }}>
          <h3>Google Sheets OAuth</h3>
          <div className="admin__form" style={{ marginTop: "0.75rem" }}>
            <label style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
              <input
                type="checkbox"
                checked={settings.googleSheets.enabled}
                onChange={(e) =>
                  setSettings((p) => ({ ...p, googleSheets: { ...p.googleSheets, enabled: e.target.checked } }))
                }
              />
              Enable Google Sheets import
            </label>
            <input
              value={settings.googleSheets.clientId}
              onChange={(e) =>
                setSettings((p) => ({ ...p, googleSheets: { ...p.googleSheets, clientId: e.target.value } }))
              }
              placeholder="Google OAuth Client ID"
            />
            <input
              value={settings.googleSheets.clientSecret}
              onChange={(e) =>
                setSettings((p) => ({ ...p, googleSheets: { ...p.googleSheets, clientSecret: e.target.value } }))
              }
              placeholder="Google OAuth Client Secret"
            />
            <input
              value={settings.googleSheets.redirectUri}
              onChange={(e) =>
                setSettings((p) => ({ ...p, googleSheets: { ...p.googleSheets, redirectUri: e.target.value } }))
              }
              placeholder="OAuth Redirect URI"
            />
            <input
              value={settings.googleSheets.sheetUrl}
              onChange={(e) =>
                setSettings((p) => ({ ...p, googleSheets: { ...p.googleSheets, sheetUrl: e.target.value } }))
              }
              placeholder="Google Sheet URL"
            />
            <input
              value={settings.googleSheets.spreadsheetId}
              onChange={(e) =>
                setSettings((p) => ({ ...p, googleSheets: { ...p.googleSheets, spreadsheetId: e.target.value } }))
              }
              placeholder="Spreadsheet ID"
            />
            <input
              value={settings.googleSheets.sheetName}
              onChange={(e) =>
                setSettings((p) => ({ ...p, googleSheets: { ...p.googleSheets, sheetName: e.target.value } }))
              }
              placeholder="Sheet Name (e.g. Sheet1)"
            />
            <label style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
              <input
                type="checkbox"
                checked={settings.googleSheets.autoSyncEnabled}
                onChange={(e) =>
                  setSettings((p) => ({
                    ...p,
                    googleSheets: { ...p.googleSheets, autoSyncEnabled: e.target.checked },
                  }))
                }
              />
              Enable auto sync
            </label>
            <input
              type="number"
              min={1}
              max={60}
              value={Number(settings.googleSheets.syncIntervalMinutes || 5)}
              onChange={(e) =>
                setSettings((p) => ({
                  ...p,
                  googleSheets: {
                    ...p.googleSheets,
                    syncIntervalMinutes: Math.min(60, Math.max(1, Number(e.target.value || 5))),
                  },
                }))
              }
              placeholder="Sync interval minutes (1-60)"
            />
            <input
              value={settings.googleSheets.webhookSecret}
              onChange={(e) =>
                setSettings((p) => ({
                  ...p,
                  googleSheets: { ...p.googleSheets, webhookSecret: e.target.value },
                }))
              }
              placeholder="Webhook Secret"
            />
            <input value={settings.googleSheets.connectedEmail} readOnly placeholder="Connected Google account" />
            <input
              value={settings.googleSheets.lastSyncAt ? new Date(settings.googleSheets.lastSyncAt).toLocaleString("en-IN") : "Never"}
              readOnly
              placeholder="Last sync"
            />
            <input value={`${settings.googleSheets.lastSyncStatus || "idle"} - ${settings.googleSheets.lastSyncMessage || ""}`} readOnly placeholder="Last sync status" />
            <div className="vendor-product-card__actions">
              <button type="button" className="secondary" onClick={save}>
                Save
              </button>
              <a className="ghost" href="/api/admin/integrations/google-sheets/oauth/start">
                Google Sign-In
              </a>
              <button type="button" className="ghost" disabled={testingSheets} onClick={testGoogleSheets}>
                {testingSheets ? "Testing..." : "Test Connection"}
              </button>
              <button type="button" className="secondary" disabled={syncingSheets} onClick={syncGoogleSheetsNow}>
                {syncingSheets ? "Syncing..." : "Sync Now"}
              </button>
            </div>
            <small>
              Webhook URL: <code>/api/admin/integrations/google-sheets/webhook</code> (header: <code>x-sync-secret</code>)
            </small>
          </div>
        </article>*/}
      </div>
      {/*<article className="admin__card" style={{ marginTop: "0.8rem" }}>
        <h3>Google Sheets Sync Logs</h3>
        <div style={{ display: "grid", gap: "0.45rem", marginTop: "0.6rem" }}>
          {logs.length ? (
            logs.slice(0, 15).map((log) => (
              <div key={log.id} className="admin__card" style={{ padding: "0.55rem 0.7rem" }}>
                <strong>{new Date(log.at).toLocaleString("en-IN")} - {log.status}</strong>
                <p>{log.message}</p>
                <small>Vendors: {log.vendorsProcessed} | Products: {log.productsProcessed}</small>
              </div>
            ))
          ) : (
            <p>No sync logs yet.</p>
          )}
        </div>
      </article>*/}
    </section>
  );
}

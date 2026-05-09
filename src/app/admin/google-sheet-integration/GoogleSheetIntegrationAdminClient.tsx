"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { readJsonSafe } from "@/lib/httpClient";

type Vendor = { id: string; name: string; email: string; isActive: boolean };
type VendorSheetLink = {
  vendorId: string;
  vendorEmail: string;
  googleLoginEmail?: string;
  lastGoogleLoginAt?: string;
  sheetId: string;
  sheetUrl: string;
  sheetName: string;
  syncStatus: "active" | "inactive" | "failed";
  enabled: boolean;
  lastSyncedAt: string;
  lastSyncMessage: string;
  googleConnected?: boolean;
};
type ApprovalEntry = {
  id: string;
  vendorId: string;
  vendorEmail: string;
  sheetName: string;
  productId: number;
  productTitle: string;
  status: "draft" | "pending_approval" | "approved" | "rejected";
  updatedAt: string;
};
type VendorSheetLog = {
  id: string;
  vendorId: string;
  at: string;
  status: "success" | "error";
  message: string;
  productsProcessed: number;
};
type SheetFile = { id: string; name: string; url: string };
type AccessRequest = {
  id: string;
  vendorId: string;
  vendorEmail: string;
  requestedGoogleEmail: string;
  sheetId: string;
  sheetName: string;
  sheetUrl: string;
  status: "pending" | "approved" | "rejected";
  note: string;
  createdAt: string;
  updatedAt: string;
};
type PermissionAudit = {
  spreadsheetId: string;
  email: string;
  emailHasDirectPermission: boolean;
  emailPermission: { id?: string; emailAddress?: string; role?: string; type?: string } | null;
  broadPermissions: Array<{ id?: string; type?: string; role?: string; domain?: string }>;
  permissions: Array<{
    id?: string;
    emailAddress?: string;
    role?: string;
    type?: string;
    domain?: string;
    allowFileDiscovery?: boolean;
  }>;
};

type IntegrationSettings = {
  googleSheets: {
    enabled: boolean;
    clientId: string;
    clientSecret: string;
    redirectUri: string;
    connectedEmail: string;
  };
};

const emptySettings: IntegrationSettings = {
  googleSheets: {
    enabled: false,
    clientId: "",
    clientSecret: "",
    redirectUri: "",
    connectedEmail: "",
  },
};

export default function GoogleSheetIntegrationAdminClient() {
  const searchParams = useSearchParams();
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [links, setLinks] = useState<VendorSheetLink[]>([]);
  const [logs, setLogs] = useState<VendorSheetLog[]>([]);
  const [sheets, setSheets] = useState<SheetFile[]>([]);
  const [selectedSheetId, setSelectedSheetId] = useState("");
  const [selectedVendorIds, setSelectedVendorIds] = useState<string[]>([]);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [settings, setSettings] = useState<IntegrationSettings>(emptySettings);
  const [approvals, setApprovals] = useState<ApprovalEntry[]>([]);
  const [accessRequests, setAccessRequests] = useState<AccessRequest[]>([]);
  const [sendEmailOnAssign, setSendEmailOnAssign] = useState(false);
  const [activeActionVendorId, setActiveActionVendorId] = useState<string | null>(null);
  const [auditVendorId, setAuditVendorId] = useState("");
  const [auditEmail, setAuditEmail] = useState("");
  const [auditResult, setAuditResult] = useState<PermissionAudit | null>(null);
  const [statusSearchQuery, setStatusSearchQuery] = useState("");
  const [requestSearchQuery, setRequestSearchQuery] = useState("");

  const selectedSheet = useMemo(
    () => sheets.find((sheet) => sheet.id === selectedSheetId) || null,
    [sheets, selectedSheetId]
  );
  const statusRows = useMemo(() => {
    const vendorById = new Map(vendors.map((vendor) => [vendor.id, vendor] as const));
    return links
      .filter((link) => Boolean(link.vendorId) && Boolean(link.sheetId) && link.enabled !== false)
      .map((link) => ({
        link,
        vendor: vendorById.get(link.vendorId) || null,
      }));
  }, [links, vendors]);
  const filteredStatusRows = useMemo(() => {
    const query = statusSearchQuery.trim().toLowerCase();
    if (!query) return statusRows;
    return statusRows.filter(({ vendor, link }) =>
      [
        vendor?.name,
        vendor?.email,
        link.sheetName,
        link.sheetId,
        link.googleLoginEmail,
        link.syncStatus,
      ]
        .join(" ")
        .toLowerCase()
        .includes(query)
    );
  }, [statusRows, statusSearchQuery]);
  const filteredAccessRequests = useMemo(() => {
    const query = requestSearchQuery.trim().toLowerCase();
    if (!query) return accessRequests;
    return accessRequests.filter((request) =>
      [
        vendors.find((v) => v.id === request.vendorId)?.name,
        request.vendorEmail,
        request.requestedGoogleEmail,
        request.sheetName,
        request.sheetId,
        request.status,
      ]
        .join(" ")
        .toLowerCase()
        .includes(query)
    );
  }, [accessRequests, requestSearchQuery, vendors]);

  const load = async () => {
    setError("");
    const [vendorsRes, linksRes, sheetsRes, settingsRes, approvalsRes, accessRequestsRes] = await Promise.all([
      fetch("/api/admin/vendor-portal", { cache: "no-store" }),
      fetch("/api/admin/vendor-sheets", { cache: "no-store" }),
      fetch("/api/admin/google-sheet-integration/sheets", { cache: "no-store" }),
      fetch("/api/admin/integrations", { cache: "no-store" }),
      fetch("/api/admin/google-sheet-approvals", { cache: "no-store" }),
      fetch("/api/admin/vendor-sheet-access-requests", { cache: "no-store" }),
    ]);
    const vendorsJson = await readJsonSafe(vendorsRes);
    const linksJson = await readJsonSafe(linksRes);
    const sheetsJson = await readJsonSafe(sheetsRes);
    const settingsJson = await readJsonSafe(settingsRes);
    const approvalsJson = await readJsonSafe(approvalsRes);
    const accessRequestsJson = await readJsonSafe(accessRequestsRes);

    if (vendorsRes.ok && !vendorsJson?.error) {
      setVendors(Array.isArray(vendorsJson?.data?.vendors) ? (vendorsJson.data.vendors as Vendor[]) : []);
    }
    if (linksRes.ok && !linksJson?.error) {
      setLinks(Array.isArray(linksJson?.links) ? (linksJson.links as VendorSheetLink[]) : []);
      setLogs(Array.isArray(linksJson?.logs) ? (linksJson.logs as VendorSheetLog[]) : []);
    }
    if (settingsRes.ok && !settingsJson?.error) {
      setSettings((settingsJson?.settings || emptySettings) as IntegrationSettings);
    }
    if (approvalsRes.ok && !approvalsJson?.error) {
      setApprovals(Array.isArray(approvalsJson?.approvals) ? (approvalsJson.approvals as ApprovalEntry[]) : []);
    }
    if (accessRequestsRes.ok && !accessRequestsJson?.error) {
      setAccessRequests(
        Array.isArray(accessRequestsJson?.requests) ? (accessRequestsJson.requests as AccessRequest[]) : []
      );
    }
    if (sheetsRes.ok && !sheetsJson?.error) {
      setSheets(Array.isArray(sheetsJson?.sheets) ? (sheetsJson.sheets as SheetFile[]) : []);
    } else if (sheetsJson?.error) {
      setError(String(sheetsJson.error));
    }
  };

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    const connected = searchParams.get("googleSheets");
    const oauthError = searchParams.get("googleSheetsError");
    if (connected === "connected") {
      setStatus("Google account connected successfully.");
      setError("");
    } else if (oauthError) {
      setError(`Google OAuth error: ${oauthError}`);
    }
  }, [searchParams]);

  const saveGoogleSettings = async () => {
    setStatus("");
    setError("");
    const res = await fetch("/api/admin/integrations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(settings),
    });
    const json = await readJsonSafe(res);
    if (!res.ok || json?.error) {
      setError(String(json?.error || "Unable to save Google settings."));
      return;
    }
    setStatus("Google OAuth settings saved.");
    setSettings((json?.settings || settings) as IntegrationSettings);
  };

  const toggleVendor = (vendorId: string) => {
    setSelectedVendorIds((prev) =>
      prev.includes(vendorId) ? prev.filter((id) => id !== vendorId) : [...prev, vendorId]
    );
  };

  const assignSheet = async () => {
    setStatus("");
    setError("");
    if (!selectedSheet || selectedVendorIds.length === 0) {
      setError("Select one sheet and at least one vendor.");
      return;
    }
    try {
      for (const vendorId of selectedVendorIds) {
        const vendor = vendors.find((entry) => entry.id === vendorId);
        if (!vendor) continue;
        const res = await fetch("/api/admin/vendor-sheets", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "update",
            vendorId,
            vendorEmail: vendor.email,
            sheetId: selectedSheet.id,
            sheetUrl: selectedSheet.url,
            sheetName: selectedSheet.name,
            enabled: true,
            notifyVendor: sendEmailOnAssign,
          }),
        });
        const json = await readJsonSafe(res);
        if (!res.ok || json?.error) {
          throw new Error(String(json?.error || `Unable to assign sheet for vendor ${vendor.name}.`));
        }
      }
      setStatus(
        `Assigned "${selectedSheet.name}" to ${selectedVendorIds.length} vendor(s).` +
          (sendEmailOnAssign ? " Email notification sent." : "")
      );
      setSelectedVendorIds([]);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to assign sheet.");
    }
  };

  const runVendorAction = async (vendorId: string, action: "sync" | "test" | "disconnect") => {
    setStatus("");
    setError("");
    const res = await fetch("/api/admin/vendor-sheets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, vendorId }),
    });
    const json = await readJsonSafe(res);
    if (!res.ok || json?.error) {
      setError(String(json?.error || `Unable to ${action}.`));
      return;
    }
    setStatus(action === "sync" ? "Vendor sync completed." : action === "test" ? "Connection successful." : "Disconnected.");
    await load();
  };

  const sendVendorSheetNotification = async (vendorId: string, vendorEmail: string) => {
    setStatus("");
    setError("");
    const res = await fetch("/api/admin/vendor-sheets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "notify", vendorId, vendorEmail }),
    });
    const json = await readJsonSafe(res);
    if (!res.ok || json?.error) {
      setError(String(json?.error || "Unable to send notification."));
      return;
    }
    setStatus("Vendor notification email sent.");
  };

  const runApprovalAction = async (approvalId: string, action: "approve" | "reject") => {
    setStatus("");
    setError("");
    if (action === "reject") {
      const confirmed = window.confirm("Reject will delete this synced product from catalog. Continue?");
      if (!confirmed) return;
    }
    const res = await fetch("/api/admin/google-sheet-approvals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ approvalId, action }),
    });
    const json = await readJsonSafe(res);
    if (!res.ok || json?.error) {
      setError(String(json?.error || `Unable to ${action}.`));
      return;
    }
    setStatus(`Approval action completed: ${action}.`);
    await load();
  };

  const runAccessRequestAction = async (requestId: string, action: "approve" | "reject") => {
    setStatus("");
    setError("");
    const res = await fetch("/api/admin/vendor-sheet-access-requests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ requestId, action }),
    });
    const json = await readJsonSafe(res);
    if (!res.ok || json?.error) {
      setError(String(json?.error || `Unable to ${action} request.`));
      return;
    }
    setStatus(`Access request ${action}d successfully.`);
    await load();
  };

  const runPermissionAudit = async () => {
    setStatus("");
    setError("");
    setAuditResult(null);
    if (!auditVendorId) {
      setError("Select a vendor for permission audit.");
      return;
    }
    const res = await fetch("/api/admin/google-sheet-permissions/audit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        vendorId: auditVendorId,
        email: auditEmail.trim().toLowerCase(),
      }),
    });
    const json = await readJsonSafe(res);
    if (!res.ok || json?.error) {
      setError(String(json?.error || "Unable to audit permissions."));
      return;
    }
    setAuditResult((json?.audit || null) as PermissionAudit | null);
    setStatus("Permission audit loaded.");
  };

  return (
    <section className="admin__panel">
      {status ? <div className="admin__alert admin__alert--success">{status}</div> : null}
      {error ? <div className="admin__alert admin__alert--error">{error}</div> : null}

      <div style={{ display: "grid", gap: "1rem" }}>
        <article className="admin__card">
          <h3>Google Sheet Integration</h3>
          <div className="admin__form" style={{ marginTop: "0.75rem", gridTemplateColumns: "repeat(2, minmax(260px, 1fr))" }}>
            <input
              value={settings.googleSheets.clientId || ""}
              onChange={(e) => setSettings((prev) => ({ ...prev, googleSheets: { ...prev.googleSheets, clientId: e.target.value } }))}
              placeholder="Google Client ID"
            />
            <input
              value={settings.googleSheets.clientSecret || ""}
              onChange={(e) => setSettings((prev) => ({ ...prev, googleSheets: { ...prev.googleSheets, clientSecret: e.target.value } }))}
              placeholder="Google Client Secret"
            />
            <input
              value={settings.googleSheets.redirectUri || ""}
              onChange={(e) => setSettings((prev) => ({ ...prev, googleSheets: { ...prev.googleSheets, redirectUri: e.target.value } }))}
              placeholder="Redirect URI (optional, auto fallback if empty)"
              style={{ gridColumn: "1 / -1" }}
            />
            <input value={settings.googleSheets.connectedEmail || ""} readOnly placeholder="Connected Google account" style={{ gridColumn: "1 / -1" }} />
          </div>
          <div className="vendor-product-card__actions" style={{ marginTop: "0.75rem" }}>
            <button className="secondary" type="button" onClick={() => void saveGoogleSettings()}>
              Save Settings
            </button>
            <button
              className="ghost"
              type="button"
              onClick={() => {
                window.location.href = "/api/admin/integrations/google-sheets/oauth/start";
              }}
              style={{ borderRadius: "999px", padding: "0.72rem 1.15rem", fontWeight: 600 }}
            >
              Connect Google
            </button>
            <button className="ghost" type="button" onClick={() => void load()}>
              Reload
            </button>
          </div>
        </article>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
          <article className="admin__card">
            <h3>Connected Sheets</h3>
            <div className="admin__form" style={{ marginTop: "0.75rem", gridTemplateColumns: "1fr" }}>
              <select value={selectedSheetId} onChange={(e) => setSelectedSheetId(e.target.value)}>
                <option value="">Select Google Sheet</option>
                {sheets.map((sheet) => (
                  <option key={sheet.id} value={sheet.id}>{sheet.name}</option>
                ))}
              </select>
              <small style={{ wordBreak: "break-all" }}>{selectedSheet ? selectedSheet.url : "Pick a sheet to assign vendors."}</small>
            </div>
          </article>

          <article className="admin__card">
            <h3>Vendor Assignments</h3>
            <div style={{ display: "grid", gap: "0.45rem", marginTop: "0.75rem", maxHeight: "260px", overflow: "auto" }}>
              {vendors.map((vendor) => (
                <label key={vendor.id} style={{ display: "flex", alignItems: "center", gap: "0.55rem" }}>
                  <input
                    type="checkbox"
                    checked={selectedVendorIds.includes(vendor.id)}
                    onChange={() => toggleVendor(vendor.id)}
                  />
                  <span>{vendor.name} ({vendor.email})</span>
                </label>
              ))}
            </div>
            <div className="vendor-product-card__actions" style={{ marginTop: "0.8rem" }}>
              <label style={{ display: "inline-flex", alignItems: "center", gap: "0.45rem", marginRight: "0.5rem" }}>
                <input
                  type="checkbox"
                  checked={sendEmailOnAssign}
                  onChange={(e) => setSendEmailOnAssign(e.target.checked)}
                />
                <span>Send email on assign</span>
              </label>
              <button className="secondary" type="button" onClick={() => void assignSheet()}>
                Assign Sheet To Selected Vendors
              </button>
            </div>
          </article>
        </div>

        <article className="admin__card">
          <h3>Product Import Status</h3>
          <div style={{ marginTop: "0.65rem", marginBottom: "0.35rem" }}>
            <input
              value={statusSearchQuery}
              onChange={(e) => setStatusSearchQuery(e.target.value)}
              placeholder="Search status by vendor, sheet, login email, sync status"
              style={{ minWidth: 360 }}
            />
          </div>
          <div className="admin__table-wrap" style={{ marginTop: "0.75rem", overflow: "visible", minHeight: "260px" }}>
            <table className="admin__table admin__table--sheet-status">
              <thead>
                <tr>
                  <th>Vendor</th>
                  <th>Google Connected</th>
                  <th>Google Login Email</th>
                  <th>Last Login</th>
                  <th>Sheet Name</th>
                  <th>Last Sync</th>
                  <th>Sync Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredStatusRows.map(({ vendor, link }) => {
                  const rowVendorId = vendor?.id || link.vendorId;
                  const rowVendorName = vendor?.name || link.vendorEmail || link.vendorId;
                  const rowVendorEmail = vendor?.email || link.vendorEmail || "";
                  return (
                    <tr key={`${link.vendorId}-${link.sheetId}`}>
                      <td>{rowVendorName}</td>
                      <td>{link.googleConnected || link.sheetId ? "Yes" : "No"}</td>
                      <td>{link.googleLoginEmail || "-"}</td>
                      <td>{link.lastGoogleLoginAt ? new Date(link.lastGoogleLoginAt).toLocaleString("en-IN") : "Never"}</td>
                      <td>{link.sheetName || "-"}</td>
                      <td>{link.lastSyncedAt ? new Date(link.lastSyncedAt).toLocaleString("en-IN") : "Never"}</td>
                      <td>{link.syncStatus || "inactive"}</td>
                      <td className="admin__table-actions-cell">
                        <div className="admin__actions-popover-wrap">
                          <button
                            className="ghost admin__edit-icon-btn"
                            type="button"
                            onClick={() => setActiveActionVendorId((prev) => (prev === rowVendorId ? null : rowVendorId))}
                            aria-label={`Open actions for ${rowVendorName}`}
                          >
                            ⋮
                          </button>
                          {activeActionVendorId === rowVendorId ? (
                            <div className="admin__actions-popover">
                              <button
                                className="ghost"
                                type="button"
                                onClick={() => {
                                  void runVendorAction(rowVendorId, "test");
                                  setActiveActionVendorId(null);
                                }}
                              >
                                Test
                              </button>
                              <button
                                className="secondary"
                                type="button"
                                onClick={() => {
                                  void runVendorAction(rowVendorId, "sync");
                                  setActiveActionVendorId(null);
                                }}
                              >
                                Sync
                              </button>
                              <button
                                className="ghost"
                                type="button"
                                onClick={() => {
                                  void sendVendorSheetNotification(rowVendorId, rowVendorEmail);
                                  setActiveActionVendorId(null);
                                }}
                              >
                                Send Mail
                              </button>
                              <button
                                className="ghost"
                                type="button"
                                onClick={() => {
                                  void runVendorAction(rowVendorId, "disconnect");
                                  setActiveActionVendorId(null);
                                }}
                              >
                                Remove
                              </button>
                            </div>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}</tbody>
            </table>
          </div>
          {!filteredStatusRows.length ? <p style={{ marginTop: "0.75rem" }}>No product import status rows found.</p> : null}
        </article>

        <article className="admin__card">
          <h3>Vendor Google Access Requests</h3>
          <div style={{ marginTop: "0.65rem", marginBottom: "0.35rem" }}>
            <input
              value={requestSearchQuery}
              onChange={(e) => setRequestSearchQuery(e.target.value)}
              placeholder="Search requests by vendor, email, sheet, status"
              style={{ minWidth: 360 }}
            />
          </div>
          <div className="vendor-product-card__actions" style={{ marginTop: "0.6rem", marginBottom: "0.2rem" }}>
            <button className="ghost" type="button" onClick={() => void load()}>
              Reload Requests
            </button>
          </div>
          <div className="admin__table-wrap" style={{ marginTop: "0.75rem", overflowX: "auto" }}>
            <table className="admin__table">
              <thead>
                <tr>
                  <th>Vendor</th>
                  <th>Vendor Email</th>
                  <th>Requested Google Email</th>
                  <th>Sheet</th>
                  <th>Status</th>
                  <th>Requested At</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredAccessRequests.map((request) => (
                  <tr key={request.id}>
                    <td>{vendors.find((v) => v.id === request.vendorId)?.name || request.vendorId}</td>
                    <td>{request.vendorEmail}</td>
                    <td>{request.requestedGoogleEmail}</td>
                    <td>
                      <a href={request.sheetUrl} target="_blank" rel="noreferrer">
                        {request.sheetName || request.sheetId}
                      </a>
                    </td>
                    <td>{request.status}</td>
                    <td>{new Date(request.createdAt).toLocaleString("en-IN")}</td>
                    <td>
                      <div className="vendor-product-card__actions">
                        <button
                          className="secondary"
                          type="button"
                          onClick={() => void runAccessRequestAction(request.id, "approve")}
                        >
                          {request.status === "approved" ? "Re-Grant Access" : "Approve"}
                        </button>
                        <button
                          className="ghost"
                          type="button"
                          onClick={() => void runAccessRequestAction(request.id, "reject")}
                        >
                          {request.status === "rejected" ? "Revoke Access Now" : "Reject"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!filteredAccessRequests.length ? <p style={{ marginTop: "0.75rem" }}>No access requests found.</p> : null}
        </article>

        <article className="admin__card">
          <h3>Google Sheet Sync Logs</h3>
          <p style={{ marginTop: "0.5rem" }}>
            Open detailed logs with vendor-wise sync history on a dedicated page.
          </p>
          <div className="vendor-product-card__actions" style={{ marginTop: "0.65rem" }}>
            <button
              className="secondary"
              type="button"
              onClick={() => {
                window.location.href = "/admin/google-sheet-integration/sync-logs";
              }}
            >
              Open Sync Logs
            </button>
          </div>
          <small style={{ display: "block", marginTop: "0.6rem" }}>
            Recent entries in memory: {logs.length}
          </small>
        </article>

        <article className="admin__card">
          <h3>Permission Audit</h3>
          <p style={{ marginTop: "0.45rem" }}>
            Live Google ACL check to diagnose who still has sheet access.
          </p>
          <div
            className="admin__form"
            style={{ marginTop: "0.75rem", gridTemplateColumns: "repeat(3, minmax(220px, 1fr))" }}
          >
            <select value={auditVendorId} onChange={(e) => setAuditVendorId(e.target.value)}>
              <option value="">Select vendor</option>
              {vendors.map((vendor) => (
                <option key={vendor.id} value={vendor.id}>
                  {vendor.name} ({vendor.email})
                </option>
              ))}
            </select>
            <input
              value={auditEmail}
              onChange={(e) => setAuditEmail(e.target.value)}
              placeholder="Check specific Google email (optional)"
            />
            <button className="secondary" type="button" onClick={() => void runPermissionAudit()}>
              Run Audit
            </button>
          </div>
          {auditResult ? (
            <div className="admin__table-wrap" style={{ marginTop: "0.75rem", overflowX: "auto" }}>
              <table className="admin__table">
                <thead>
                  <tr>
                    <th>Spreadsheet</th>
                    <th>Email Checked</th>
                    <th>Direct Access</th>
                    <th>Direct Role</th>
                    <th>Broad Sharing</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>{auditResult.spreadsheetId}</td>
                    <td>{auditResult.email || "-"}</td>
                    <td>{auditResult.emailHasDirectPermission ? "Yes" : "No"}</td>
                    <td>{auditResult.emailPermission?.role || "-"}</td>
                    <td>
                      {auditResult.broadPermissions.length
                        ? auditResult.broadPermissions
                            .map((entry) => `${entry.type}:${entry.role}${entry.domain ? ` (${entry.domain})` : ""}`)
                            .join(", ")
                        : "None"}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          ) : null}
        </article>

        <article className="admin__card">
          <h3>Pending Google Sheet Products</h3>
          <div className="admin__table-wrap" style={{ marginTop: "0.75rem", overflowX: "auto" }}>
            <table className="admin__table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Vendor</th>
                  <th>Sheet</th>
                  <th>Status</th>
                  <th>Updated</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {approvals.filter((entry) => entry.status === "pending_approval").map((entry) => (
                  <tr key={entry.id}>
                    <td>
                      <strong>{entry.productTitle}</strong>
                      <small>#{entry.productId}</small>
                    </td>
                    <td>{entry.vendorEmail}</td>
                    <td>{entry.sheetName}</td>
                    <td>{entry.status}</td>
                    <td>{new Date(entry.updatedAt).toLocaleString("en-IN")}</td>
                    <td>
                      <div className="vendor-product-card__actions">
                        <button className="secondary" type="button" onClick={() => void runApprovalAction(entry.id, "approve")}>Approve</button>
                        <button className="ghost" type="button" onClick={() => void runApprovalAction(entry.id, "reject")}>Reject</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!approvals.some((entry) => entry.status === "pending_approval") ? (
            <p style={{ marginTop: "0.75rem" }}>No pending products for approval.</p>
          ) : null}
        </article>
      </div>
    </section>
  );
}

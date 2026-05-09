"use client";

import { useRouter } from "next/navigation";
import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import { readJsonSafe } from "@/lib/httpClient";

type VendorRecord = {
  id: string;
  name: string;
  code: string;
  email: string;
  phone?: string;
  contactPerson?: string;
  businessName?: string;
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
  passwordHash: string;
  states: string[];
  isActive: boolean;
  commissionPercent?: number;
};

type VendorStore = {
  id: string;
  vendorId: string;
  state: string;
  city: string;
  storeName: string;
  address: string;
  phone: string;
  pincode: string;
  isActive: boolean;
};

type VendorPortalData = {
  vendors: VendorRecord[];
  stores: VendorStore[];
  updatedAt: string;
};

type VendorsAdminClientProps = {
  detailVendorId?: string;
};
type VendorSheetLink = {
  vendorId: string;
  vendorEmail: string;
  sheetId: string;
  sheetUrl: string;
  sheetName: string;
  syncStatus: "active" | "inactive" | "failed";
  googleConnected?: boolean;
  enabled: boolean;
  lastSyncedAt: string;
  lastSyncMessage: string;
};

const emptyData: VendorPortalData = { vendors: [], stores: [], updatedAt: "" };

const emptyVendorDraft = {
  id: "",
  name: "",
  code: "",
  email: "",
  phone: "",
  contactPerson: "",
  businessName: "",
  address: "",
  city: "",
  state: "",
  pincode: "",
  commissionPercent: "10",
  statesCsv: "",
  isActive: true,
};

export default function VendorsAdminClient({ detailVendorId }: VendorsAdminClientProps) {
  const router = useRouter();
  const isDetailPage = typeof detailVendorId === "string";
  const [data, setData] = useState<VendorPortalData>(emptyData);
  const [selectedVendorId, setSelectedVendorId] = useState("");
  const [selectedVendorIds, setSelectedVendorIds] = useState<string[]>([]);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [passwordDraft, setPasswordDraft] = useState("");
  const [showEditor, setShowEditor] = useState(false);
  const [vendorDraft, setVendorDraft] = useState(emptyVendorDraft);
  const [storeDraft, setStoreDraft] = useState<VendorStore>({
    id: "",
    vendorId: "",
    state: "",
    city: "",
    storeName: "",
    address: "",
    phone: "",
    pincode: "",
    isActive: true,
  });
  const bulkVendorFileInputRef = useRef<HTMLInputElement | null>(null);
  const [importingGoogleSheet, setImportingGoogleSheet] = useState(false);
  const [vendorSheet, setVendorSheet] = useState<VendorSheetLink | null>(null);
  const [vendorSheetMap, setVendorSheetMap] = useState<Record<string, VendorSheetLink>>({});
  const [vendorSheetLogs, setVendorSheetLogs] = useState<Array<{ id: string; at: string; status: string; message: string; productsProcessed: number }>>([]);
  const [searchQuery, setSearchQuery] = useState("");

  const load = async () => {
    setError("");
    const res = await fetch("/api/admin/vendor-portal");
    const json = await readJsonSafe(res);
    if (!res.ok || json.error) {
      setError(json.error || "Unable to load vendor portal data.");
      return;
    }
    const nextData = (json.data || emptyData) as VendorPortalData;
    setData(nextData);

    if (detailVendorId === "new") {
      setSelectedVendorId("");
      setShowEditor(true);
      setVendorDraft(emptyVendorDraft);
      return;
    }
    if (detailVendorId && nextData.vendors.some((vendor) => vendor.id === detailVendorId)) {
      setSelectedVendorId(detailVendorId);
      return;
    }
    if (!selectedVendorId && nextData.vendors[0]?.id) {
      setSelectedVendorId(nextData.vendors[0].id);
    }
    const sheetRes = await fetch("/api/admin/vendor-sheets", { cache: "no-store" });
    const sheetJson = await readJsonSafe(sheetRes);
    if (sheetRes.ok && !sheetJson?.error) {
      const links = Array.isArray(sheetJson?.links) ? (sheetJson.links as VendorSheetLink[]) : [];
      const logs = Array.isArray(sheetJson?.logs) ? sheetJson.logs : [];
      setVendorSheetMap(
        Object.fromEntries(
          links.map((item) => [item.vendorId, item] as const)
        )
      );
      const currentVendorId = detailVendorId && detailVendorId !== "new" ? detailVendorId : (selectedVendorId || nextData.vendors[0]?.id || "");
      const found = links.find((item: VendorSheetLink) => item.vendorId === currentVendorId) || null;
      setVendorSheet(found);
      setVendorSheetLogs(logs.filter((entry: { vendorId?: string }) => String(entry.vendorId || "") === currentVendorId));
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detailVendorId]);

  const selectedVendor = useMemo(
    () => data.vendors.find((vendor) => vendor.id === selectedVendorId) || null,
    [data.vendors, selectedVendorId]
  );

  const vendorStores = useMemo(
    () => data.stores.filter((store) => store.vendorId === selectedVendorId),
    [data.stores, selectedVendorId]
  );
  const filteredVendors = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return data.vendors;
    return data.vendors.filter((vendor) =>
      [
        vendor.name,
        vendor.email,
        vendor.phone,
        vendor.state,
        vendor.city,
        vendor.businessName,
      ]
        .join(" ")
        .toLowerCase()
        .includes(query)
    );
  }, [data.vendors, searchQuery]);

  useEffect(() => {
    if (!selectedVendor) {
      if (detailVendorId === "new") setShowEditor(true);
      return;
    }
    setShowEditor(true);
    setVendorDraft({
      id: selectedVendor.id,
      name: selectedVendor.name || "",
      code: selectedVendor.code || "",
      email: selectedVendor.email || "",
      phone: selectedVendor.phone || "",
      contactPerson: selectedVendor.contactPerson || "",
      businessName: selectedVendor.businessName || "",
      address: selectedVendor.address || "",
      city: selectedVendor.city || "",
      state: selectedVendor.state || "",
      pincode: selectedVendor.pincode || "",
      commissionPercent: String(selectedVendor.commissionPercent ?? 10),
      statesCsv: (selectedVendor.states || []).join(", "),
      isActive: selectedVendor.isActive,
    });
  }, [detailVendorId, selectedVendor]);

  const saveAll = async (nextData: VendorPortalData) => {
    setError("");
    setStatus("");
    const res = await fetch("/api/admin/vendor-portal", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(nextData),
    });
    const json = await readJsonSafe(res);
    if (!res.ok || json.error) {
      setError(json.error || "Unable to save vendor portal data.");
      return false;
    }
    setData(json.data as VendorPortalData);
    return true;
  };

  const saveVendor = async () => {
    if (!vendorDraft.name.trim() || !vendorDraft.email.trim()) {
      setError("Vendor name and email are required.");
      return;
    }
    const states = vendorDraft.statesCsv
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean);

    const nextVendor: VendorRecord = {
      id: vendorDraft.id || `vendor_${Math.random().toString(36).slice(2, 10)}`,
      name: vendorDraft.name.trim(),
      code: (vendorDraft.code || vendorDraft.name).trim().toLowerCase().replace(/[^a-z0-9]+/g, "-"),
      email: vendorDraft.email.trim().toLowerCase(),
      phone: vendorDraft.phone.trim(),
      contactPerson: vendorDraft.contactPerson.trim(),
      businessName: vendorDraft.businessName.trim(),
      address: vendorDraft.address.trim(),
      city: vendorDraft.city.trim(),
      state: vendorDraft.state.trim(),
      pincode: vendorDraft.pincode.trim(),
      commissionPercent: Math.min(100, Math.max(0, Number(vendorDraft.commissionPercent || "0"))),
      states,
      isActive: vendorDraft.isActive,
      passwordHash: selectedVendor?.passwordHash || "",
    };

    const others = data.vendors.filter((vendor) => vendor.id !== nextVendor.id);
    const ok = await saveAll({ ...data, vendors: [...others, nextVendor] });
    if (ok) {
      setSelectedVendorId(nextVendor.id);
      setVendorDraft((prev) => ({ ...prev, id: nextVendor.id }));
      setStatus(vendorDraft.id ? "Vendor updated." : "Vendor created.");
      if (detailVendorId === "new") router.replace(`/admin/vendors/${nextVendor.id}`);
    }
  };

  const deleteSelectedVendor = async () => {
    if (!selectedVendorId) {
      setError("Select a vendor first.");
      return;
    }
    const res = await fetch(`/api/admin/vendor-portal?vendorId=${encodeURIComponent(selectedVendorId)}`, {
      method: "DELETE",
    });
    const json = await readJsonSafe(res);
    if (!res.ok || json.error) {
      setError(json.error || "Unable to delete vendor.");
      return;
    }
    setData((json.data || emptyData) as VendorPortalData);
    setStatus("Vendor deleted.");
    if (isDetailPage) router.push("/admin/vendors");
  };

  const createFreshVendor = () => {
    if (!isDetailPage) {
      router.push("/admin/vendors/new");
      return;
    }
    setSelectedVendorId("");
    setShowEditor(true);
    setVendorDraft(emptyVendorDraft);
    setPasswordDraft("");
    setError("");
    setStatus("New vendor form ready.");
  };

  const deleteSelectedVendors = async () => {
    if (!selectedVendorIds.length) {
      setError("Select at least one vendor.");
      return;
    }
    setError("");
    setStatus("Deleting selected vendors...");
    for (const vendorId of selectedVendorIds) {
      // eslint-disable-next-line no-await-in-loop
      await fetch(`/api/admin/vendor-portal?vendorId=${encodeURIComponent(vendorId)}`, { method: "DELETE" });
    }
    setSelectedVendorIds([]);
    setSelectedVendorId("");
    await load();
    setStatus("Selected vendors deleted.");
  };

  const downloadVendorSampleCsv = () => {
    const csvSafe = (value: string) => `"${String(value || "").replace(/"/g, "\"\"")}"`;
    const header = [
      "name",
      "email",
      "phone",
      "contact_person",
      "business_name",
      "address",
      "city",
      "state",
      "pincode",
      "commission_percent",
      "states_csv",
      "is_active",
    ];
    const sample = [
      "PCGS",
      "services@pcgs.co.in",
      "8825675328",
      "Ganesh",
      "PCGS Enterprises",
      "OMR Road",
      "Chennai",
      "Tamil Nadu",
      "600126",
      "15",
      "Tamil Nadu, Karnataka",
      "true",
    ];
    const csv = `${header.map(csvSafe).join(",")}\n${sample.map(csvSafe).join(",")}`;
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "vendors-sample-template.csv";
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const handleBulkVendorCsvUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    if (!event.target.files?.length) return;
    const file = event.target.files[0];
    const text = await file.text();
    const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    if (lines.length < 2) {
      setError("CSV must contain header and at least one vendor row.");
      return;
    }
    const parseCsvLine = (line: string) => {
      const cols: string[] = [];
      let cur = "";
      let quoted = false;
      for (let i = 0; i < line.length; i += 1) {
        const ch = line[i];
        if (ch === '"') {
          if (quoted && line[i + 1] === '"') {
            cur += '"';
            i += 1;
          } else {
            quoted = !quoted;
          }
        } else if (ch === "," && !quoted) {
          cols.push(cur.trim());
          cur = "";
        } else {
          cur += ch;
        }
      }
      cols.push(cur.trim());
      return cols;
    };

    const headers = parseCsvLine(lines[0]).map((h) => h.toLowerCase());
    const rows = lines.slice(1);
    const nextVendors = [...data.vendors];
    let success = 0;
    for (const rowLine of rows) {
      const cols = parseCsvLine(rowLine);
      const row: Record<string, string> = {};
      headers.forEach((h, i) => {
        row[h] = cols[i] || "";
      });
      const name = String(row.name || "").trim();
      const email = String(row.email || "").trim().toLowerCase();
      if (!name || !email) continue;
      const existing = nextVendors.findIndex((v) => v.email.toLowerCase() === email);
      const vendor: VendorRecord = {
        id: existing >= 0 ? nextVendors[existing].id : `vendor_${Math.random().toString(36).slice(2, 10)}`,
        name,
        code: name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
        email,
        phone: String(row.phone || "").trim(),
        contactPerson: String(row.contact_person || "").trim(),
        businessName: String(row.business_name || "").trim(),
        address: String(row.address || "").trim(),
        city: String(row.city || "").trim(),
        state: String(row.state || "").trim(),
        pincode: String(row.pincode || "").trim(),
        commissionPercent: Math.min(100, Math.max(0, Number(row.commission_percent || 10))),
        states: String(row.states_csv || "")
          .split(",")
          .map((entry) => entry.trim())
          .filter(Boolean),
        isActive: String(row.is_active || "true").toLowerCase() !== "false",
        passwordHash: existing >= 0 ? nextVendors[existing].passwordHash : "",
      };
      if (existing >= 0) nextVendors[existing] = vendor;
      else nextVendors.push(vendor);
      success += 1;
    }
    const saved = await saveAll({ ...data, vendors: nextVendors });
    if (saved) {
      setStatus(`Bulk vendor upload completed. ${success} vendor(s) processed.`);
      await load();
    }
    event.target.value = "";
  };

  const savePassword = async () => {
    if (!selectedVendorId || !passwordDraft.trim()) {
      setError("Select vendor and enter a password.");
      return;
    }
    setError("");
    setStatus("Saving vendor password...");
    const res = await fetch("/api/admin/vendor-portal/set-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ vendorId: selectedVendorId, password: passwordDraft }),
    });
    const json = await readJsonSafe(res);
    if (!res.ok || json.error) {
      setError(json.error || "Unable to set vendor password.");
      setStatus("");
      return;
    }
    setData(json.data as VendorPortalData);
    setPasswordDraft("");
    setStatus("Vendor password updated.");
  };

  const importVendorsFromGoogleSheet = async () => {
    setImportingGoogleSheet(true);
    setError("");
    setStatus("");
    try {
      const res = await fetch("/api/admin/vendor-portal/google-sheets-import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sheetName: "Sheet1" }),
      });
      const json = await readJsonSafe(res);
      if (!res.ok || json?.error) {
        setError(String(json?.error || "Unable to import vendors from Google Sheets."));
        return;
      }
      setStatus(`Google Sheets import complete. ${Number(json?.processed || 0)} vendor(s) processed.`);
      await load();
    } finally {
      setImportingGoogleSheet(false);
    }
  };

  const vendorSheetAction = async (action: "sync" | "test" | "disconnect") => {
    const targetVendorId = selectedVendorId || detailVendorId || "";
    if (!targetVendorId) {
      setError("Select vendor first.");
      return;
    }
    const res = await fetch("/api/admin/vendor-sheets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, vendorId: targetVendorId }),
    });
    const json = await readJsonSafe(res);
    if (!res.ok || json?.error) {
      setError(String(json?.error || `Unable to ${action} vendor sheet.`));
      return;
    }
    setStatus(action === "sync" ? "Vendor sheet synced." : action === "test" ? "Connection successful." : "Vendor sheet disconnected.");
    await load();
  };

  const addStore = async () => {
    const vendorId = selectedVendorId || vendorDraft.id;
    if (!vendorId) {
      setError("Create or select a vendor first.");
      return;
    }
    if (!storeDraft.state.trim() || !storeDraft.city.trim() || !storeDraft.storeName.trim()) {
      setError("State, city, and store name are required.");
      return;
    }
    const nextStore: VendorStore = {
      ...storeDraft,
      id: storeDraft.id || `store_${Math.random().toString(36).slice(2, 10)}`,
      vendorId,
      state: storeDraft.state.trim(),
      city: storeDraft.city.trim(),
      storeName: storeDraft.storeName.trim(),
      address: storeDraft.address.trim(),
      phone: storeDraft.phone.trim(),
      pincode: storeDraft.pincode.trim(),
      isActive: storeDraft.isActive,
    };
    const ok = await saveAll({ ...data, stores: [...data.stores, nextStore] });
    if (ok) {
      setStoreDraft({
        id: "",
        vendorId,
        state: "",
        city: "",
        storeName: "",
        address: "",
        phone: "",
        pincode: "",
        isActive: true,
      });
    }
  };

  const removeStore = async (storeId: string) => {
    await saveAll({ ...data, stores: data.stores.filter((store) => store.id !== storeId) });
  };

  return (
    <section className="admin__panel">
      {isDetailPage ? (
        <div style={{ marginBottom: "0.9rem" }}>
          <button className="secondary" type="button" onClick={() => router.push("/admin/vendors")}>
            Back To Vendors
          </button>
        </div>
      ) : null}

      {!isDetailPage ? (
        <>
          <div style={{ display: "flex", gap: "0.6rem", marginBottom: "0.9rem", flexWrap: "wrap" }}>
            <button className="secondary" onClick={createFreshVendor}>Add Vendor</button>
            <button className="ghost" onClick={() => void deleteSelectedVendors()}>Delete Selected Vendor</button>
            <button className="secondary" onClick={downloadVendorSampleCsv}>Download Sample Template</button>
            <button className="secondary" type="button" onClick={() => bulkVendorFileInputRef.current?.click()}>
              Bulk Upload CSV
            </button>
            {/*<button className="secondary" type="button" disabled={importingGoogleSheet} onClick={() => void importVendorsFromGoogleSheet()}>
              {importingGoogleSheet ? "Importing..." : "Import from Google Sheet"}
            </button>*/}
            <input
              ref={bulkVendorFileInputRef}
              type="file"
              accept=".csv,text/csv"
              onChange={handleBulkVendorCsvUpload}
              style={{ display: "none" }}
            />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search vendors by name, email, phone, state"
              style={{ minWidth: 320 }}
            />
          </div>

          <div className="vendor-products-table-wrap" style={{ marginBottom: "0.9rem" }}>
            <table className="vendor-products-table">
              <thead>
                <tr>
                  <th style={{ width: 42 }}>
                    <input
                      type="checkbox"
                      checked={filteredVendors.length > 0 && filteredVendors.every((vendor) => selectedVendorIds.includes(vendor.id))}
                      onChange={() =>
                        setSelectedVendorIds((prev) =>
                          filteredVendors.every((vendor) => prev.includes(vendor.id))
                            ? prev.filter((id) => !filteredVendors.some((vendor) => vendor.id === id))
                            : Array.from(new Set([...prev, ...filteredVendors.map((vendor) => vendor.id)]))
                        )
                      }
                      aria-label="Select all vendors"
                    />
                  </th>
                  <th>Vendor</th>
                  <th>Contact</th>
                  <th>State</th>
                  <th>Commission</th>
                  <th>Google Connected</th>
                  <th>Sheet Name</th>
                  <th>Last Sync</th>
                  <th>Sync Status</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredVendors.map((vendor) => (
                  <tr
                    key={vendor.id}
                    className={selectedVendorId === vendor.id ? "is-selected" : ""}
                    onClick={() => {
                      router.push(`/admin/vendors/${vendor.id}`);
                    }}
                  >
                    <td onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selectedVendorIds.includes(vendor.id)}
                        onChange={() =>
                          setSelectedVendorIds((prev) =>
                            prev.includes(vendor.id) ? prev.filter((id) => id !== vendor.id) : [...prev, vendor.id]
                          )
                        }
                        aria-label={`Select vendor ${vendor.name}`}
                      />
                    </td>
                    <td>
                      <strong>{vendor.name}</strong>
                      <small>{vendor.email}</small>
                    </td>
                    <td>{vendor.phone || "-"}</td>
                    <td>{vendor.state || "-"}</td>
                    <td>{Number(vendor.commissionPercent ?? 10)}%</td>
                    <td>{vendorSheetMap[vendor.id]?.googleConnected || vendorSheetMap[vendor.id]?.sheetId ? "Yes" : "No"}</td>
                    <td>{vendorSheetMap[vendor.id]?.sheetName || "-"}</td>
                    <td>
                      {vendorSheetMap[vendor.id]?.lastSyncedAt
                        ? new Date(vendorSheetMap[vendor.id].lastSyncedAt).toLocaleString("en-IN")
                        : "Never"}
                    </td>
                    <td>
                      <span
                        className={`vendor-status-badge status-${
                          vendorSheetMap[vendor.id]?.syncStatus === "failed"
                            ? "archived"
                            : vendorSheetMap[vendor.id]?.syncStatus === "active"
                              ? "active"
                              : "draft"
                        }`}
                      >
                        {vendorSheetMap[vendor.id]?.syncStatus || "inactive"}
                      </span>
                    </td>
                    <td>
                      <span className={`vendor-status-badge status-${vendor.isActive ? "active" : "archived"}`}>
                        {vendor.isActive ? "Active" : "Inactive"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!filteredVendors.length ? <p style={{ marginTop: "0.75rem" }}>No vendors found.</p> : null}
          </div>
        </>
      ) : null}

      {status ? <p style={{ color: "#0c8f4f", fontWeight: 600 }}>{status}</p> : null}
      {error ? <p style={{ color: "#b73333", fontWeight: 600 }}>{error}</p> : null}

      {isDetailPage && showEditor ? (
        <div className="admin__grid admin__grid--four" style={{ marginTop: "1rem" }}>
          <article className="admin__card" style={{ gridColumn: "span 2" }}>
            <h3>Vendors</h3>
            <div className="admin__form" style={{ marginTop: "0.75rem" }}>
              <input value={vendorDraft.name} onChange={(e) => setVendorDraft((prev) => ({ ...prev, name: e.target.value }))} placeholder="Vendor name" />
              <input value={vendorDraft.contactPerson} onChange={(e) => setVendorDraft((prev) => ({ ...prev, contactPerson: e.target.value }))} placeholder="Contact person" />
              <input value={vendorDraft.businessName} onChange={(e) => setVendorDraft((prev) => ({ ...prev, businessName: e.target.value }))} placeholder="Business name" />
              <input value={vendorDraft.email} onChange={(e) => setVendorDraft((prev) => ({ ...prev, email: e.target.value }))} placeholder="Vendor login email" />
              <input value={vendorDraft.phone} onChange={(e) => setVendorDraft((prev) => ({ ...prev, phone: e.target.value }))} placeholder="Phone" />
              <input value={vendorDraft.address} onChange={(e) => setVendorDraft((prev) => ({ ...prev, address: e.target.value }))} placeholder="Address" />
              <input value={vendorDraft.city} onChange={(e) => setVendorDraft((prev) => ({ ...prev, city: e.target.value }))} placeholder="City" />
              <input value={vendorDraft.state} onChange={(e) => setVendorDraft((prev) => ({ ...prev, state: e.target.value }))} placeholder="State" />
              <input value={vendorDraft.pincode} onChange={(e) => setVendorDraft((prev) => ({ ...prev, pincode: e.target.value }))} placeholder="Pincode" />
              <input value={vendorDraft.commissionPercent} onChange={(e) => setVendorDraft((prev) => ({ ...prev, commissionPercent: e.target.value }))} placeholder="Commission % (vendor)" />
              <input value={vendorDraft.code} onChange={(e) => setVendorDraft((prev) => ({ ...prev, code: e.target.value }))} placeholder="Vendor code" />
              <input value={vendorDraft.statesCsv} onChange={(e) => setVendorDraft((prev) => ({ ...prev, statesCsv: e.target.value }))} placeholder="Service states (comma separated)" />
              <label style={{ display: "flex", alignItems: "center", gap: "0.45rem" }}>
                <input type="checkbox" checked={vendorDraft.isActive} onChange={(e) => setVendorDraft((prev) => ({ ...prev, isActive: e.target.checked }))} />
                Vendor active
              </label>
              <button className="secondary" onClick={() => void saveVendor()}>{vendorDraft.id ? "Update Vendor" : "Create Vendor"}</button>
            </div>
          </article>

          <article className="admin__card" style={{ gridColumn: "span 2" }}>
            <h3>Vendor Login Password</h3>
            <div className="admin__form">
              <input type="password" value={passwordDraft} onChange={(e) => setPasswordDraft(e.target.value)} placeholder="Minimum 6 characters" />
              <button className="secondary" onClick={() => void savePassword()}>Update Password</button>
              <small>Vendor can use email + password from vendor login page.</small>
            </div>
          </article>
        </div>
      ) : isDetailPage ? (
        <div className="admin__alert admin__alert--info">Select a vendor row to view/edit details, or click Add Vendor.</div>
      ) : null}

      {isDetailPage ? (
        <div className="admin__grid admin__grid--four" style={{ marginTop: "1rem" }}>
          <article className="admin__card" style={{ gridColumn: "span 2" }}>
            <h3>Add Vendor Service Location</h3>
            <div className="admin__form">
              <input value={storeDraft.state} onChange={(e) => setStoreDraft((prev) => ({ ...prev, state: e.target.value }))} placeholder="State" />
              <input value={storeDraft.city} onChange={(e) => setStoreDraft((prev) => ({ ...prev, city: e.target.value }))} placeholder="City" />
              <input value={storeDraft.storeName} onChange={(e) => setStoreDraft((prev) => ({ ...prev, storeName: e.target.value }))} placeholder="Store name" />
              <input value={storeDraft.address} onChange={(e) => setStoreDraft((prev) => ({ ...prev, address: e.target.value }))} placeholder="Address" />
              <input value={storeDraft.phone} onChange={(e) => setStoreDraft((prev) => ({ ...prev, phone: e.target.value }))} placeholder="Phone" />
              <input value={storeDraft.pincode} onChange={(e) => setStoreDraft((prev) => ({ ...prev, pincode: e.target.value }))} placeholder="Pincode" />
              <label style={{ display: "flex", alignItems: "center", gap: "0.45rem" }}>
                <input type="checkbox" checked={storeDraft.isActive} onChange={(e) => setStoreDraft((prev) => ({ ...prev, isActive: e.target.checked }))} />
                Location active
              </label>
              <button className="secondary" onClick={() => void addStore()}>Add Location</button>
            </div>
          </article>

          <article className="admin__card" style={{ gridColumn: "span 2" }}>
            <h3>Vendor Locations ({vendorStores.length})</h3>
            <div style={{ display: "grid", gap: "0.55rem" }}>
              {vendorStores.length ? (
                vendorStores.map((store) => (
                  <div key={store.id} className="admin__card" style={{ padding: "0.7rem" }}>
                    <strong>{store.storeName}</strong>
                    <p>{store.city}, {store.state} - {store.pincode || "N/A"}</p>
                    <p>{store.address || "No address"}</p>
                    <p>{store.phone || "No phone"}</p>
                    <button className="ghost" onClick={() => void removeStore(store.id)}>Remove</button>
                  </div>
                ))
              ) : (
                <p>No locations mapped for selected vendor.</p>
              )}
            </div>
          </article>
          {/*<article className="admin__card" style={{ gridColumn: "span 4" }}>
            <h3>Vendor Google Sheet Integration</h3>
            <div className="admin__form" style={{ marginTop: "0.75rem" }}>
              <input value={vendorSheet?.googleConnected ? "Connected" : "Not connected"} readOnly placeholder="Google status" />
              <input value={vendorSheet?.sheetName || ""} readOnly placeholder="Sheet Name" />
              <div className="vendor-product-card__actions">
                <button className="ghost" type="button" onClick={() => void vendorSheetAction("test")}>
                  Test Connection
                </button>
                <button className="secondary" type="button" onClick={() => void vendorSheetAction("sync")}>
                  Sync Now
                </button>
                <button className="ghost" type="button" onClick={() => void vendorSheetAction("disconnect")}>
                  Disconnect
                </button>
              </div>
              <small>
                Status: {vendorSheet?.syncStatus || "inactive"} | Last Sync:{" "}
                {vendorSheet?.lastSyncedAt ? new Date(vendorSheet.lastSyncedAt).toLocaleString("en-IN") : "Never"}
              </small>
              <small>{vendorSheet?.lastSyncMessage || "No sync message yet."}</small>
              <div style={{ display: "grid", gap: "0.5rem", marginTop: "0.6rem" }}>
                {vendorSheetLogs.slice(0, 10).map((log) => (
                  <div key={log.id} className="admin__card" style={{ padding: "0.55rem 0.7rem" }}>
                    <strong>{new Date(log.at).toLocaleString("en-IN")} - {log.status}</strong>
                    <p>{log.message}</p>
                  </div>
                ))}
              </div>
            </div>
          </article>*/}
        </div>
      ) : null}
    </section>
  );
}

"use client";

import { useEffect, useMemo, useState } from "react";

type AccountRow = {
  email: string;
  name: string;
  source: string;
  role: "user" | "vendor_admin" | "cms_admin";
};

export default function AssignRolesClient() {
  const [rows, setRows] = useState<AccountRow[]>([]);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  const filteredRows = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return rows;
    return rows.filter((row) =>
      [row.name, row.email, row.source, row.role].join(" ").toLowerCase().includes(query)
    );
  }, [rows, searchQuery]);

  const load = async () => {
    setError("");
    const res = await fetch("/api/admin/roles", { cache: "no-store" });
    const json = await res.json();
    if (!res.ok || json.error) {
      setError(json.error || "Unable to load roles.");
      return;
    }
    setRows((json.accounts || []) as AccountRow[]);
  };

  useEffect(() => {
    void load();
  }, []);

  const updateRole = async (email: string, role: AccountRow["role"]) => {
    setStatus("");
    setError("");
    const res = await fetch("/api/admin/roles", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, role }),
    });
    const json = await res.json();
    if (!res.ok || json.error) {
      setError(json.error || "Unable to update role.");
      return;
    }
    setRows((prev) => prev.map((row) => (row.email === email ? { ...row, role } : row)));
    setStatus("Role updated.");
  };

  return (
    <section className="admin__panel">
      {status ? <div className="admin__alert admin__alert--success">{status}</div> : null}
      {error ? <div className="admin__alert admin__alert--error">{error}</div> : null}
      <div style={{ marginBottom: "0.75rem" }}>
        <input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search by name, email, source, role"
          style={{ minWidth: 320 }}
        />
      </div>
      <div className="vendor-products-table-wrap">
        <table className="vendor-products-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Source</th>
              <th>Role</th>
            </tr>
          </thead>
          <tbody>
            {filteredRows.map((row) => (
              <tr key={row.email}>
                <td><strong>{row.name || "-"}</strong></td>
                <td><small>{row.email}</small></td>
                <td>{row.source}</td>
                <td>
                  <select value={row.role} onChange={(e) => void updateRole(row.email, e.target.value as AccountRow["role"])}>
                    <option value="user">user</option>
                    <option value="vendor_admin">vendor admin</option>
                    <option value="cms_admin">cms admin</option>
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!filteredRows.length ? <p style={{ marginTop: "0.75rem" }}>No accounts found.</p> : null}
      </div>
    </section>
  );
}

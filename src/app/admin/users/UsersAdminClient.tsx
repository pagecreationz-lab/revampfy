"use client";

import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type AdminUser = {
  email: string;
  name: string;
  mobile: string;
  address: string;
  paymentMode: "UPI" | "Card" | "NetBanking" | "COD";
  needsProfileCompletion: boolean;
  createdAt: string;
  updatedAt: string;
};

type UsersAdminClientProps = {
  detailEmail?: string;
};

const emptyForm = {
  email: "",
  password: "",
  name: "",
  mobile: "",
  address: "",
  paymentMode: "UPI" as AdminUser["paymentMode"],
};

export default function UsersAdminClient({ detailEmail }: UsersAdminClientProps) {
  const router = useRouter();
  const isDetailPage = typeof detailEmail === "string";
  const csvInputRef = useRef<HTMLInputElement | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [selectedEmail, setSelectedEmail] = useState("");
  const [selectedEmails, setSelectedEmails] = useState<string[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [showEditor, setShowEditor] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const selected = useMemo(
    () => users.find((user) => user.email === selectedEmail) || null,
    [users, selectedEmail]
  );
  const filteredUsers = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return users;
    return users.filter((user) =>
      [user.name, user.email, user.mobile, user.address].join(" ").toLowerCase().includes(query)
    );
  }, [users, searchQuery]);

  const loadUsers = async () => {
    const res = await fetch("/api/admin/users", { cache: "no-store" });
    const json = await res.json();
    if (!res.ok || json.error) throw new Error(json.error || "Failed to load users");
    const nextUsers = (json.users || []) as AdminUser[];
    setUsers(nextUsers);
    if (detailEmail === "new") {
      setSelectedEmail("");
      setShowEditor(true);
      setForm(emptyForm);
      return;
    }
    if (detailEmail && nextUsers.some((user) => user.email === detailEmail)) {
      setSelectedEmail(detailEmail);
    }
  };

  useEffect(() => {
    loadUsers().catch((err) => setError(err instanceof Error ? err.message : "Failed to load users"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detailEmail]);

  useEffect(() => {
    if (!selected) {
      if (detailEmail === "new") setShowEditor(true);
      return;
    }
    setShowEditor(true);
    setForm({
      email: selected.email,
      password: "",
      name: selected.name || "",
      mobile: selected.mobile || "",
      address: selected.address || "",
      paymentMode: selected.paymentMode || "UPI",
    });
  }, [detailEmail, selected]);

  const createUser = async () => {
    setMessage("");
    setError("");
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const json = await res.json();
      if (!res.ok || json.error) throw new Error(json.error || "Unable to create user");
      setMessage("User created.");
      await loadUsers();
      if (json.user?.email) {
        router.replace(`/admin/users/${encodeURIComponent(json.user.email)}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to create user");
    }
  };

  const updateUser = async () => {
    setMessage("");
    setError("");
    if (!selectedEmail) {
      setError("Select a user first.");
      return;
    }
    try {
      const res = await fetch("/api/admin/users", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: selectedEmail,
          nextEmail: form.email,
          password: form.password || undefined,
          name: form.name,
          mobile: form.mobile,
          address: form.address,
          paymentMode: form.paymentMode,
        }),
      });
      const json = await res.json();
      if (!res.ok || json.error) throw new Error(json.error || "Unable to update user");
      setSelectedEmail(json.user?.email || form.email);
      setForm((prev) => ({ ...prev, password: "" }));
      setMessage("User updated.");
      await loadUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update user");
    }
  };

  const deleteUserByEmail = async (email: string) => {
    const res = await fetch(`/api/admin/users?email=${encodeURIComponent(email)}`, { method: "DELETE" });
    const json = await res.json();
    if (!res.ok || json.error) throw new Error(json.error || `Unable to delete ${email}`);
  };

  const deleteCurrentUser = async () => {
    setMessage("");
    setError("");
    if (!selectedEmail) {
      setError("Select a user first.");
      return;
    }
    try {
      await deleteUserByEmail(selectedEmail);
      setMessage("User deleted.");
      setSelectedEmail("");
      setForm(emptyForm);
      await loadUsers();
      if (isDetailPage) router.push("/admin/users");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to delete user");
    }
  };

  const deleteSelectedUsers = async () => {
    setMessage("");
    setError("");
    if (!selectedEmails.length) {
      setError("Select at least one user.");
      return;
    }
    try {
      for (const email of selectedEmails) {
        // eslint-disable-next-line no-await-in-loop
        await deleteUserByEmail(email);
      }
      setSelectedEmails([]);
      setMessage("Selected users deleted.");
      await loadUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to delete selected users");
    }
  };

  const downloadSampleCsv = () => {
    const csvSafe = (value: string) => `"${String(value || "").replace(/"/g, "\"\"")}"`;
    const header = ["email", "password", "name", "mobile", "address", "payment_mode"];
    const sample = ["demo.user@example.com", "Pass@12345", "Demo User", "9876543210", "Chennai, Tamil Nadu", "UPI"];
    const csv = `${header.map(csvSafe).join(",")}\n${sample.map(csvSafe).join(",")}`;
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "users-sample-template.csv";
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const handleBulkCsvUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    if (!event.target.files?.length) return;
    const file = event.target.files[0];
    const text = await file.text();
    const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    if (lines.length < 2) {
      setError("CSV must contain header and at least one user row.");
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
    let processed = 0;
    for (const rowLine of rows) {
      const cols = parseCsvLine(rowLine);
      const row: Record<string, string> = {};
      headers.forEach((h, i) => {
        row[h] = cols[i] || "";
      });
      const email = String(row.email || "").trim().toLowerCase();
      const password = String(row.password || "").trim();
      if (!email || !password) continue;

      const existing = users.find((user) => user.email.toLowerCase() === email);
      const body = {
        email: existing ? existing.email : email,
        nextEmail: email,
        password,
        name: String(row.name || "").trim(),
        mobile: String(row.mobile || "").trim(),
        address: String(row.address || "").trim(),
        paymentMode: (String(row.payment_mode || "UPI").trim() || "UPI") as AdminUser["paymentMode"],
      };

      const endpointRes = await fetch("/api/admin/users", {
        method: existing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(existing ? body : { ...body, email }),
      });
      const endpointJson = await endpointRes.json();
      if (!endpointRes.ok || endpointJson.error) {
        throw new Error(endpointJson.error || `Failed for user: ${email}`);
      }
      processed += 1;
    }
    setMessage(`Bulk upload completed. ${processed} user(s) processed.`);
    await loadUsers();
    event.target.value = "";
  };

  const addUser = () => {
    if (!isDetailPage) {
      router.push("/admin/users/new");
      return;
    }
    setSelectedEmail("");
    setForm(emptyForm);
    setShowEditor(true);
  };

  return (
    <div className="admin__panel">
      {isDetailPage ? (
        <div style={{ marginBottom: "0.9rem" }}>
          <button className="secondary" type="button" onClick={() => router.push("/admin/users")}>
            Back To Users
          </button>
        </div>
      ) : null}

      {!isDetailPage ? (
        <>
          <div style={{ display: "flex", gap: "0.6rem", marginBottom: "0.7rem", flexWrap: "wrap" }}>
            <button className="primary" type="button" onClick={addUser}>Add User</button>
            <button className="ghost" type="button" onClick={deleteSelectedUsers}>Delete Selected User</button>
            <button className="secondary" type="button" onClick={downloadSampleCsv}>Download Sample CSV</button>
            <button className="secondary" type="button" onClick={() => csvInputRef.current?.click()}>Bulk User Upload</button>
            <input ref={csvInputRef} type="file" accept=".csv,text/csv" style={{ display: "none" }} onChange={handleBulkCsvUpload} />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search users by name, email, mobile, address"
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
                      checked={filteredUsers.length > 0 && filteredUsers.every((user) => selectedEmails.includes(user.email))}
                      onChange={() =>
                        setSelectedEmails((prev) =>
                          filteredUsers.every((user) => prev.includes(user.email))
                            ? prev.filter((email) => !filteredUsers.some((user) => user.email === email))
                            : Array.from(new Set([...prev, ...filteredUsers.map((user) => user.email)]))
                        )
                      }
                    />
                  </th>
                  <th>User Name</th>
                  <th>User Email</th>
                  <th>Mobile</th>
                  <th>Address</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((user) => (
                  <tr key={user.email} onClick={() => router.push(`/admin/users/${encodeURIComponent(user.email)}`)}>
                    <td onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selectedEmails.includes(user.email)}
                        onChange={() =>
                          setSelectedEmails((prev) =>
                            prev.includes(user.email) ? prev.filter((mail) => mail !== user.email) : [...prev, user.email]
                          )
                        }
                      />
                    </td>
                    <td><strong>{user.name || "No name"}</strong></td>
                    <td><small>{user.email}</small></td>
                    <td>{user.mobile || "-"}</td>
                    <td>{user.address || "-"}</td>
                    <td>
                      <span className={`vendor-status-badge status-${user.needsProfileCompletion ? "draft" : "active"}`}>
                        {user.needsProfileCompletion ? "Pending" : "Active"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!filteredUsers.length ? <p style={{ marginTop: "0.75rem" }}>No users found.</p> : null}
          </div>
        </>
      ) : null}

      {showEditor ? (
        <div className="admin__form">
          <h3>User Form</h3>
          <input value={form.email} onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))} placeholder="Email" />
          <input type="password" value={form.password} onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))} placeholder={selectedEmail ? "New password (optional)" : "Password"} />
          <input value={form.name} onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))} placeholder="Name" />
          <input value={form.mobile} onChange={(e) => setForm((prev) => ({ ...prev, mobile: e.target.value }))} placeholder="Mobile" />
          <input value={form.address} onChange={(e) => setForm((prev) => ({ ...prev, address: e.target.value }))} placeholder="Address" />
          <select value={form.paymentMode} onChange={(e) => setForm((prev) => ({ ...prev, paymentMode: e.target.value as typeof form.paymentMode }))}>
            <option value="UPI">UPI</option>
            <option value="Card">Card</option>
            <option value="NetBanking">NetBanking</option>
            <option value="COD">COD</option>
          </select>
          <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap" }}>
            <button className="primary" onClick={createUser}>Create User</button>
            <button className="secondary" onClick={updateUser}>Update User</button>
            <button className="ghost" onClick={deleteCurrentUser}>Delete User</button>
          </div>
        </div>
      ) : isDetailPage ? (
        <div className="admin__alert admin__alert--info">User not found.</div>
      ) : null}

      {message ? <div className="admin__alert admin__alert--success">{message}</div> : null}
      {error ? <div className="admin__alert admin__alert--error">{error}</div> : null}
    </div>
  );
}

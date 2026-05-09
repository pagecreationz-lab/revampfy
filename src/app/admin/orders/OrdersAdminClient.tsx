"use client";

import { useEffect, useMemo, useState } from "react";
import { readJsonSafe } from "@/lib/httpClient";

type AdminOrderRow = {
  id: string;
  orderRef: string;
  vendor: string;
  status: string;
  customerName: string;
  customerEmail: string;
  mobile: string;
  address: string;
  street: string;
  area: string;
  city: string;
  state: string;
  pincode: string;
  vendorAmount: number;
  totalPrice: number;
  createdAt: string;
};

export default function OrdersAdminClient() {
  const [orders, setOrders] = useState<AdminOrderRow[]>([]);
  const [vendors, setVendors] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "successful" | "failure" | "draft">("all");
  const [daysFilter, setDaysFilter] = useState<"today" | "7" | "30">("30");
  const [vendorFilter, setVendorFilter] = useState("all");
  const [selectedOrder, setSelectedOrder] = useState<AdminOrderRow | null>(null);
  const [editor, setEditor] = useState<Partial<AdminOrderRow> | null>(null);
  const [saving, setSaving] = useState(false);
  const [creating, setCreating] = useState(false);

  const load = async () => {
      setLoading(true);
      setError("");
      try {
        const params = new URLSearchParams({
          status: statusFilter,
          days: daysFilter,
          vendor: vendorFilter,
          q: query,
        });
        const res = await fetch(`/api/admin/orders?${params.toString()}`, { cache: "no-store" });
        const json = await readJsonSafe(res);
        if (!res.ok) throw new Error(String(json?.error || "Unable to load orders."));
        setOrders(Array.isArray(json?.orders) ? (json.orders as AdminOrderRow[]) : []);
        setVendors(Array.isArray(json?.vendors) ? (json.vendors as string[]) : []);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Unable to load orders.");
      } finally {
        setLoading(false);
      }
  };

  useEffect(() => {
    void load();
  }, [statusFilter, daysFilter, vendorFilter, query]);

  const filtered = useMemo(() => orders, [orders]);

  const openCreate = () => {
    setCreating(true);
    setSelectedOrder(null);
    setEditor({
      orderRef: `MANUAL-${Date.now()}`,
      vendor: vendors[0] || "",
      status: "draft",
      customerName: "",
      customerEmail: "",
      mobile: "",
      address: "",
      street: "",
      area: "",
      city: "",
      state: "",
      pincode: "",
      vendorAmount: 0,
      totalPrice: 0,
      createdAt: new Date().toISOString(),
    });
  };

  const openEdit = (order: AdminOrderRow) => {
    setCreating(false);
    setSelectedOrder(order);
    setEditor({ ...order });
  };

  const saveEditor = async () => {
    if (!editor) return;
    setSaving(true);
    setError("");
    try {
      if (creating) {
        const res = await fetch("/api/admin/orders", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(editor),
        });
        const json = await readJsonSafe(res);
        if (!res.ok) throw new Error(String(json?.error || "Unable to add order."));
      } else {
        const res = await fetch("/api/admin/orders", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: selectedOrder?.id, patch: editor }),
        });
        const json = await readJsonSafe(res);
        if (!res.ok) throw new Error(String(json?.error || "Unable to update order."));
      }
      setEditor(null);
      setSelectedOrder(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to save order.");
    } finally {
      setSaving(false);
    }
  };

  const deleteSelected = async () => {
    if (!selectedOrder?.id) return;
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/orders?id=${encodeURIComponent(selectedOrder.id)}`, {
        method: "DELETE",
      });
      const json = await readJsonSafe(res);
      if (!res.ok) throw new Error(String(json?.error || "Unable to delete order."));
      setEditor(null);
      setSelectedOrder(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to delete order.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="admin__panel">
      <div className="vendor-products-toolbar" style={{ marginBottom: "0.75rem" }}>
        <button type="button" className="secondary" onClick={openCreate}>
          Add Order
        </button>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as "all" | "successful" | "failure" | "draft")}>
          <option value="all">All orders</option>
          <option value="successful">Successful</option>
          <option value="failure">Failure</option>
          <option value="draft">Draft</option>
        </select>
        <select value={daysFilter} onChange={(e) => setDaysFilter(e.target.value as "today" | "7" | "30")}>
          <option value="today">Today</option>
          <option value="7">Last 7 days</option>
          <option value="30">Last 30 days</option>
        </select>
        <select value={vendorFilter} onChange={(e) => setVendorFilter(e.target.value)}>
          <option value="all">All vendors</option>
          {vendors.map((vendor) => (
            <option key={`vendor-filter-${vendor}`} value={vendor.toLowerCase()}>
              {vendor}
            </option>
          ))}
        </select>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by order, vendor, customer, state"
        />
      </div>
      {loading ? <p>Loading orders...</p> : null}
      {error ? <div className="admin__alert admin__alert--error">{error}</div> : null}
      {!loading ? (
        <div className="vendor-products-table-wrap">
          <table className="vendor-products-table">
            <thead>
              <tr>
                <th>Order</th>
                <th>Status</th>
                <th>Vendor</th>
                <th>User Name</th>
                <th>User Email</th>
                <th>Sale Amount</th>
                <th>Vendor Profit</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((order) => (
                <tr key={order.id} onClick={() => openEdit(order)} style={{ cursor: "pointer" }}>
                  <td>
                    <strong>{order.orderRef}</strong>
                    <small>{new Date(order.createdAt).toLocaleString("en-IN")}</small>
                  </td>
                  <td>{order.status}</td>
                  <td>{order.vendor}</td>
                  <td>{order.customerName}</td>
                  <td>{order.customerEmail}</td>
                  <td>Rs {Number(order.totalPrice || 0).toLocaleString("en-IN")}</td>
                  <td>Rs {Number(order.vendorAmount || 0).toLocaleString("en-IN")}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!filtered.length ? <p style={{ marginTop: "0.8rem" }}>No orders found.</p> : null}
        </div>
      ) : null}
      {editor ? (
        <div className="vendor-profile-drawer-wrap" role="dialog" aria-modal="true">
          <button
            type="button"
            className="vendor-profile-drawer-backdrop"
            aria-label="Close order editor"
            onClick={() => {
              setEditor(null);
              setSelectedOrder(null);
            }}
          />
          <aside className="vendor-modal admin__card vendor-admin__profile-card">
            <div className="vendor-profile-drawer__head">
              <h3>{creating ? "Add Order" : "Edit Order"}</h3>
              <button className="ghost" type="button" onClick={() => setEditor(null)}>
                Close
              </button>
            </div>
            <div className="admin__form">
              <input value={editor.orderRef || ""} onChange={(e) => setEditor((prev) => ({ ...(prev || {}), orderRef: e.target.value }))} placeholder="Order reference" />
              <input value={editor.vendor || ""} onChange={(e) => setEditor((prev) => ({ ...(prev || {}), vendor: e.target.value }))} placeholder="Vendor" />
              <input value={editor.status || ""} onChange={(e) => setEditor((prev) => ({ ...(prev || {}), status: e.target.value }))} placeholder="Status" />
              <input value={editor.customerName || ""} onChange={(e) => setEditor((prev) => ({ ...(prev || {}), customerName: e.target.value }))} placeholder="Customer name" />
              <input value={editor.customerEmail || ""} onChange={(e) => setEditor((prev) => ({ ...(prev || {}), customerEmail: e.target.value }))} placeholder="Customer email" />
              <input value={editor.mobile || ""} onChange={(e) => setEditor((prev) => ({ ...(prev || {}), mobile: e.target.value }))} placeholder="Mobile" />
              <textarea value={editor.address || ""} onChange={(e) => setEditor((prev) => ({ ...(prev || {}), address: e.target.value }))} placeholder="Address" rows={2} />
              <input value={editor.street || ""} onChange={(e) => setEditor((prev) => ({ ...(prev || {}), street: e.target.value }))} placeholder="Street" />
              <input value={editor.area || ""} onChange={(e) => setEditor((prev) => ({ ...(prev || {}), area: e.target.value }))} placeholder="Area" />
              <input value={editor.city || ""} onChange={(e) => setEditor((prev) => ({ ...(prev || {}), city: e.target.value }))} placeholder="City" />
              <input value={editor.state || ""} onChange={(e) => setEditor((prev) => ({ ...(prev || {}), state: e.target.value }))} placeholder="State" />
              <input value={editor.pincode || ""} onChange={(e) => setEditor((prev) => ({ ...(prev || {}), pincode: e.target.value }))} placeholder="Pincode" />
              <input
                type="number"
                value={Number(editor.vendorAmount || 0)}
                onChange={(e) => setEditor((prev) => ({ ...(prev || {}), vendorAmount: Number(e.target.value || 0) }))}
                placeholder="Vendor amount"
              />
              <input
                type="number"
                value={Number(editor.totalPrice || 0)}
                onChange={(e) => setEditor((prev) => ({ ...(prev || {}), totalPrice: Number(e.target.value || 0) }))}
                placeholder="Total price"
              />
              <div className="vendor-product-card__actions">
                <button type="button" className="secondary" disabled={saving} onClick={saveEditor}>
                  {saving ? "Saving..." : creating ? "Create Order" : "Save Changes"}
                </button>
                {!creating ? (
                  <button type="button" className="ghost" disabled={saving} onClick={deleteSelected}>
                    Delete Order
                  </button>
                ) : null}
              </div>
            </div>
          </aside>
        </div>
      ) : null}
    </section>
  );
}

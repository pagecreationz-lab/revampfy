"use client";

import { useEffect, useState } from "react";

type CustomerProfile = {
  email: string;
  name: string;
  mobile: string;
  address: string;
  paymentMode: "UPI" | "Card" | "NetBanking" | "COD";
  createdAt: string;
  updatedAt: string;
};

type CustomerOrder = {
  id: string;
  email: string;
  orderRef: string;
  status: string;
  total: number;
  invoiceUrl?: string;
  lineItems: Array<{ variantId: number; quantity: number }>;
  createdAt: string;
};

function formatPrice(value: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number.isFinite(value) ? value : 0);
}

export function CustomerPortalClient({ email }: { email: string }) {
  const [profile, setProfile] = useState<CustomerProfile | null>(null);
  const [orders, setOrders] = useState<CustomerOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const loadData = async () => {
    setLoading(true);
    setError("");
    try {
      const [profileRes, ordersRes] = await Promise.all([
        fetch("/api/auth/profile"),
        fetch("/api/auth/orders"),
      ]);
      const profileJson = await profileRes.json();
      const ordersJson = await ordersRes.json();

      if (!profileRes.ok) {
        throw new Error(profileJson.error || "Unable to load profile");
      }
      if (!ordersRes.ok) {
        throw new Error(ordersJson.error || "Unable to load orders");
      }

      setProfile(profileJson.profile);
      setOrders(ordersJson.orders || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load portal data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const updateProfile = async () => {
    if (!profile) return;
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const res = await fetch("/api/auth/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: profile.name,
          mobile: profile.mobile,
          address: profile.address,
          paymentMode: profile.paymentMode,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || "Unable to save profile.");
      }
      setProfile(json.profile);
      setMessage("Profile updated successfully.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save profile.");
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      window.location.href = "/login";
    } finally {
      setLoggingOut(false);
    }
  };

  return (
    <div className="user-dashboard">
      <div className="user-dashboard__top">
        <div>
          <p className="eyebrow">User Portal</p>
          <h1>My Account</h1>
          <p className="hero__subtext">Signed in as {email}</p>
        </div>
        <div className="user-dashboard__actions">
          <a href="/store">
            <button className="secondary" type="button">
              Continue Shopping
            </button>
          </a>
          <a href="/cart">
            <button className="secondary" type="button">
              My Cart
            </button>
          </a>
          <button className="ghost" type="button" onClick={handleLogout} disabled={loggingOut}>
            {loggingOut ? "Logging out..." : "Logout"}
          </button>
        </div>
      </div>

      {error ? <div className="admin__alert admin__alert--error">{error}</div> : null}
      {message ? <div className="admin__alert admin__alert--success">{message}</div> : null}
      {loading ? <p className="hero__subtext">Loading account...</p> : null}

      {!loading && profile ? (
        <>
          <section className="admin__panel" style={{ marginTop: "1rem" }}>
            <h2>Profile & Payment Mode</h2>
            <div className="admin__form">
              <input type="email" value={profile.email} disabled />
              <input
                value={profile.name}
                onChange={(event) => setProfile((prev) => (prev ? { ...prev, name: event.target.value } : prev))}
                placeholder="Full name"
              />
              <input
                value={profile.mobile}
                onChange={(event) => setProfile((prev) => (prev ? { ...prev, mobile: event.target.value } : prev))}
                placeholder="Mobile number"
              />
              <textarea
                rows={3}
                value={profile.address}
                onChange={(event) => setProfile((prev) => (prev ? { ...prev, address: event.target.value } : prev))}
                placeholder="Address"
              />
              <select
                value={profile.paymentMode}
                onChange={(event) =>
                  setProfile((prev) =>
                    prev ? { ...prev, paymentMode: event.target.value as CustomerProfile["paymentMode"] } : prev
                  )
                }
              >
                <option value="UPI">UPI</option>
                <option value="Card">Card</option>
                <option value="NetBanking">NetBanking</option>
                <option value="COD">Cash on Delivery</option>
              </select>
              <button className="primary" type="button" onClick={updateProfile} disabled={saving}>
                {saving ? "Saving..." : "Save Profile"}
              </button>
            </div>
          </section>

          <section className="admin__panel" style={{ marginTop: "1rem" }}>
            <h2>Order History</h2>
            {orders.length ? (
              <div className="user-dashboard__table-wrap">
                <table className="user-dashboard__table">
                  <thead>
                    <tr>
                      <th>Order Ref</th>
                      <th>Date</th>
                      <th>Items</th>
                      <th>Total</th>
                      <th>Status</th>
                      <th>Payment</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.map((order) => (
                      <tr key={order.id}>
                        <td>{order.orderRef}</td>
                        <td>{new Date(order.createdAt).toLocaleString()}</td>
                        <td>{order.lineItems.reduce((sum, item) => sum + item.quantity, 0)}</td>
                        <td>{formatPrice(order.total)}</td>
                        <td>{order.status}</td>
                        <td>
                          {order.invoiceUrl ? (
                            <a href={order.invoiceUrl} target="_blank" rel="noreferrer">
                              Pay now
                            </a>
                          ) : (
                            "-"
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="hero__subtext">No orders yet. Start from Store and place your first order.</p>
            )}
          </section>
        </>
      ) : null}
    </div>
  );
}

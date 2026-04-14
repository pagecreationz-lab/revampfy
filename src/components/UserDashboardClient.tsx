"use client";

import { useState } from "react";
import type { ShopifyCustomer } from "@/lib/shopify";

type UserDashboardClientProps = {
  email: string;
  role: string;
  sessionExpiry: string;
  customers: ShopifyCustomer[];
  customersError: string;
  totalProducts: number;
  totalCategories: number;
  lastSynced: string;
};

export function UserDashboardClient(props: UserDashboardClientProps) {
  const [loggingOut, setLoggingOut] = useState(false);

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
          <p className="eyebrow">User Dashboard</p>
          <h1>Customer Portal</h1>
          <p className="hero__subtext">
            Signed in as <strong>{props.email}</strong> ({props.role}) | Session until{" "}
            {props.sessionExpiry}
          </p>
        </div>
        <div className="user-dashboard__actions">
          <a href="/admin">
            <button className="secondary" type="button">
              Open CMS Admin
            </button>
          </a>
          <a href="/store">
            <button className="secondary" type="button">
              Go to Store
            </button>
          </a>
          <button className="ghost" type="button" onClick={handleLogout} disabled={loggingOut}>
            {loggingOut ? "Logging out..." : "Logout"}
          </button>
        </div>
      </div>

      <div className="user-dashboard__stats">
        <article className="info-card">
          <h3>Synced Products</h3>
          <p>{props.totalProducts}</p>
        </article>
        <article className="info-card">
          <h3>Synced Categories</h3>
          <p>{props.totalCategories}</p>
        </article>
        <article className="info-card">
          <h3>Last Sync</h3>
          <p>{props.lastSynced}</p>
        </article>
      </div>

      <section className="admin__panel" style={{ marginTop: "1rem" }}>
        <h2>Shopify Backend Users</h2>
        {props.customersError ? (
          <div className="admin__alert admin__alert--error">{props.customersError}</div>
        ) : props.customers.length ? (
          <div className="user-dashboard__table-wrap">
            <table className="user-dashboard__table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Orders</th>
                  <th>Status</th>
                  <th>Tags</th>
                </tr>
              </thead>
              <tbody>
                {props.customers.map((customer) => {
                  const name =
                    `${customer.first_name || ""} ${customer.last_name || ""}`.trim() ||
                    "Customer";
                  return (
                    <tr key={customer.id}>
                      <td>{name}</td>
                      <td>{customer.email || "-"}</td>
                      <td>{customer.orders_count || 0}</td>
                      <td>{customer.state || "-"}</td>
                      <td>{customer.tags || "-"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="hero__subtext">No Shopify customers found yet.</p>
        )}
      </section>
    </div>
  );
}

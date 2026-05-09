"use client";

import { useEffect, useState } from "react";

type ConfigShape = {
  paymentGateway: "manual" | "razorpay" | "payu" | "cod";
  razorpayEnabled: boolean;
  enableCod: boolean;
  requireGpsForCod: boolean;
  requireGpsForAllPayments: boolean;
  razorpayKeyId: string;
  razorpayKeySecret: string;
  payuEnabled: boolean;
  payuKey: string;
  payuSalt: string;
  payuAuthHeader: string;
  payuWebhookSecret: string;
  shiprocketEnabled: boolean;
  shiprocketEmail: string;
  shiprocketPassword: string;
  shiprocketPickupLocation: string;
  shiprocketWebhookSecret: string;
};

const emptyConfig: ConfigShape = {
  paymentGateway: "manual",
  razorpayEnabled: true,
  enableCod: true,
  requireGpsForCod: true,
  requireGpsForAllPayments: true,
  razorpayKeyId: "",
  razorpayKeySecret: "",
  payuEnabled: false,
  payuKey: "",
  payuSalt: "",
  payuAuthHeader: "",
  payuWebhookSecret: "",
  shiprocketEnabled: false,
  shiprocketEmail: "",
  shiprocketPassword: "",
  shiprocketPickupLocation: "Primary",
  shiprocketWebhookSecret: "",
};

export default function PaymentGatewaySettingsClient() {
  const [form, setForm] = useState<ConfigShape>(emptyConfig);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  const load = async () => {
    setError("");
    const res = await fetch("/api/admin/commerce-config", { cache: "no-store" });
    const json = await res.json();
    if (!res.ok || json.error) {
      setError(json.error || "Unable to load payment settings.");
      return;
    }
    setForm({ ...emptyConfig, ...(json.config || {}) });
  };

  useEffect(() => {
    void load();
  }, []);

  const save = async () => {
    setStatus("");
    setError("");
    const res = await fetch("/api/admin/commerce-config", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const json = await res.json();
    if (!res.ok || json.error) {
      setError(json.error || "Unable to save payment settings.");
      return;
    }
    setStatus("Payment settings saved.");
  };

  return (
    <section className="admin__panel">
      <div className="admin__form">
        <h3>Default Payment Flow</h3>
        <select value={form.paymentGateway} onChange={(e) => setForm((prev) => ({ ...prev, paymentGateway: e.target.value as ConfigShape["paymentGateway"] }))}>
          <option value="manual">manual</option>
          <option value="razorpay">razorpay</option>
          <option value="payu">payu</option>
          <option value="cod">cod</option>
        </select>

        <h3>Razorpay</h3>
        <label style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
          <input type="checkbox" checked={form.razorpayEnabled} onChange={(e) => setForm((prev) => ({ ...prev, razorpayEnabled: e.target.checked }))} />
          Enable Razorpay
        </label>
        <input value={form.razorpayKeyId} onChange={(e) => setForm((prev) => ({ ...prev, razorpayKeyId: e.target.value }))} placeholder="Razorpay API Key ID" />
        <input value={form.razorpayKeySecret} onChange={(e) => setForm((prev) => ({ ...prev, razorpayKeySecret: e.target.value }))} placeholder="Razorpay Secret Key" />

        <h3>PayU</h3>
        <label style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
          <input type="checkbox" checked={form.payuEnabled} onChange={(e) => setForm((prev) => ({ ...prev, payuEnabled: e.target.checked }))} />
          Enable PayU
        </label>
        <input value={form.payuKey} onChange={(e) => setForm((prev) => ({ ...prev, payuKey: e.target.value }))} placeholder="PayU Key" />
        <input value={form.payuSalt} onChange={(e) => setForm((prev) => ({ ...prev, payuSalt: e.target.value }))} placeholder="PayU Salt / Secret" />
        <input value={form.payuAuthHeader} onChange={(e) => setForm((prev) => ({ ...prev, payuAuthHeader: e.target.value }))} placeholder="PayU OAuth/Auth Header (optional)" />
        <input value={form.payuWebhookSecret} onChange={(e) => setForm((prev) => ({ ...prev, payuWebhookSecret: e.target.value }))} placeholder="PayU Webhook Secret" />

        <h3>Cash On Delivery</h3>
        <label style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
          <input type="checkbox" checked={form.enableCod} onChange={(e) => setForm((prev) => ({ ...prev, enableCod: e.target.checked }))} />
          Enable COD
        </label>
        <label style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
          <input type="checkbox" checked={form.requireGpsForCod} onChange={(e) => setForm((prev) => ({ ...prev, requireGpsForCod: e.target.checked }))} />
          Require exact GPS location for COD
        </label>
        <label style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
          <input
            type="checkbox"
            checked={form.requireGpsForAllPayments}
            onChange={(e) => setForm((prev) => ({ ...prev, requireGpsForAllPayments: e.target.checked }))}
          />
          Require exact GPS location for all payment methods
        </label>

        <h3>Shiprocket</h3>
        <label style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
          <input type="checkbox" checked={form.shiprocketEnabled} onChange={(e) => setForm((prev) => ({ ...prev, shiprocketEnabled: e.target.checked }))} />
          Enable Shiprocket Auto Shipment
        </label>
        <input value={form.shiprocketEmail} onChange={(e) => setForm((prev) => ({ ...prev, shiprocketEmail: e.target.value }))} placeholder="Shiprocket Login Email" />
        <input value={form.shiprocketPassword} onChange={(e) => setForm((prev) => ({ ...prev, shiprocketPassword: e.target.value }))} placeholder="Shiprocket Password / Token" />
        <input value={form.shiprocketPickupLocation} onChange={(e) => setForm((prev) => ({ ...prev, shiprocketPickupLocation: e.target.value }))} placeholder="Shiprocket Pickup Location (name)" />
        <input value={form.shiprocketWebhookSecret} onChange={(e) => setForm((prev) => ({ ...prev, shiprocketWebhookSecret: e.target.value }))} placeholder="Shiprocket Webhook Secret" />

        <button className="primary" type="button" onClick={save}>Save Settings</button>
      </div>
      {status ? <div className="admin__alert admin__alert--success">{status}</div> : null}
      {error ? <div className="admin__alert admin__alert--error">{error}</div> : null}
    </section>
  );
}

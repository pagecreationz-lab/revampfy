"use client";

import { useEffect, useState } from "react";
import { readJsonSafe } from "@/lib/httpClient";

type EnquirySettings = {
  mailTo: string;
  smtpHost: string;
  smtpPort: number;
  smtpUser: string;
  smtpPass: string;
  smtpFrom: string;
  enableAutoReplyContact: boolean;
  enableAutoReplyBulk: boolean;
  autoReplyContactSubject: string;
  autoReplyContactBody: string;
  autoReplyBulkSubject: string;
  autoReplyBulkBody: string;
  maskedSmtpPass?: string;
};

const defaults: EnquirySettings = {
  mailTo: "",
  smtpHost: "",
  smtpPort: 587,
  smtpUser: "",
  smtpPass: "",
  smtpFrom: "",
  enableAutoReplyContact: true,
  enableAutoReplyBulk: true,
  autoReplyContactSubject: "",
  autoReplyContactBody: "",
  autoReplyBulkSubject: "",
  autoReplyBulkBody: "",
  maskedSmtpPass: "",
};

export default function EmailIntegrationAdminClient() {
  const [settings, setSettings] = useState<EnquirySettings>(defaults);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setError("");
    const res = await fetch("/api/admin/enquiry-settings", { cache: "no-store" });
    const json = await readJsonSafe(res);
    if (!res.ok || json.error) {
      setError(json.error || "Unable to load email integration settings.");
      return;
    }
    setSettings({ ...defaults, ...(json.settings || {}) });
  };

  useEffect(() => {
    void load();
  }, []);

  const save = async () => {
    setSaving(true);
    setMessage("");
    setError("");
    try {
      const res = await fetch("/api/admin/enquiry-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      const json = await readJsonSafe(res);
      if (!res.ok || json.error) {
        throw new Error(json.error || "Unable to save email integration settings.");
      }
      setSettings({ ...defaults, ...(json.settings || {}) });
      setMessage("Email integration saved.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save email integration settings.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="admin__panel">
      <div className="admin__form">
        <h3>SMTP Configuration</h3>
        <input
          value={settings.mailTo}
          onChange={(e) => setSettings((prev) => ({ ...prev, mailTo: e.target.value }))}
          placeholder="Notification recipient email (mailTo)"
        />
        <input
          value={settings.smtpHost}
          onChange={(e) => setSettings((prev) => ({ ...prev, smtpHost: e.target.value }))}
          placeholder="SMTP Host"
        />
        <input
          value={String(settings.smtpPort || 587)}
          onChange={(e) =>
            setSettings((prev) => ({
              ...prev,
              smtpPort: Number(e.target.value || 587),
            }))
          }
          placeholder="SMTP Port"
        />
        <input
          value={settings.smtpUser}
          onChange={(e) => setSettings((prev) => ({ ...prev, smtpUser: e.target.value }))}
          placeholder="SMTP User"
        />
        <input
          type="password"
          value={settings.smtpPass}
          onChange={(e) => setSettings((prev) => ({ ...prev, smtpPass: e.target.value }))}
          placeholder={`SMTP Password (${settings.maskedSmtpPass || "not set"})`}
        />
        <input
          value={settings.smtpFrom}
          onChange={(e) => setSettings((prev) => ({ ...prev, smtpFrom: e.target.value }))}
          placeholder="SMTP From (display sender)"
        />

        <h3>Contact Form Auto Reply</h3>
        <label style={{ display: "flex", alignItems: "center", gap: "0.45rem" }}>
          <input
            type="checkbox"
            checked={settings.enableAutoReplyContact}
            onChange={(e) =>
              setSettings((prev) => ({ ...prev, enableAutoReplyContact: e.target.checked }))
            }
          />
          Enable Contact Auto Reply
        </label>
        <input
          value={settings.autoReplyContactSubject}
          onChange={(e) =>
            setSettings((prev) => ({ ...prev, autoReplyContactSubject: e.target.value }))
          }
          placeholder="Contact auto-reply subject"
        />
        <textarea
          rows={5}
          value={settings.autoReplyContactBody}
          onChange={(e) => setSettings((prev) => ({ ...prev, autoReplyContactBody: e.target.value }))}
          placeholder="Contact auto-reply body"
        />

        <h3>Bulk Enquiry Auto Reply</h3>
        <label style={{ display: "flex", alignItems: "center", gap: "0.45rem" }}>
          <input
            type="checkbox"
            checked={settings.enableAutoReplyBulk}
            onChange={(e) =>
              setSettings((prev) => ({ ...prev, enableAutoReplyBulk: e.target.checked }))
            }
          />
          Enable Bulk Enquiry Auto Reply
        </label>
        <input
          value={settings.autoReplyBulkSubject}
          onChange={(e) => setSettings((prev) => ({ ...prev, autoReplyBulkSubject: e.target.value }))}
          placeholder="Bulk enquiry auto-reply subject"
        />
        <textarea
          rows={5}
          value={settings.autoReplyBulkBody}
          onChange={(e) => setSettings((prev) => ({ ...prev, autoReplyBulkBody: e.target.value }))}
          placeholder="Bulk enquiry auto-reply body"
        />

        <button className="primary" onClick={save} disabled={saving}>
          {saving ? "Saving..." : "Save Email Integration"}
        </button>
      </div>

      {message ? <div className="admin__alert admin__alert--success">{message}</div> : null}
      {error ? <div className="admin__alert admin__alert--error">{error}</div> : null}
    </section>
  );
}

"use client";

import { useEffect, useState } from "react";
import { readJsonSafe } from "@/lib/httpClient";

type DefaultMethod = "emailPassword" | "emailCode" | "mobileOtp" | "google";
type OtpProvider = "fast2sms" | "twilio" | "twofactor";

type AuthSettings = {
  enableEmailPasswordLogin: boolean;
  enableEmailCodeLogin: boolean;
  enableMobileOtpLogin: boolean;
  enableGoogleLogin: boolean;
  defaultSignInMethod: DefaultMethod;
  vendorEnableEmailPasswordLogin: boolean;
  vendorEnableEmailCodeLogin: boolean;
  vendorDefaultSignInMethod: "emailPassword" | "emailCode";
  googleClientId: string;
  googleRedirectUri: string;
  maskedGoogleClientSecret: string;
  twilioAccountSid: string;
  twilioVerifyServiceSid: string;
  maskedTwilioAuthToken: string;
  mobileOtpProvider: OtpProvider;
  fast2smsSenderId: string;
  maskedFast2smsApiKey: string;
  twofactorTemplateName: string;
  maskedTwofactorApiKey: string;
};

const defaultSettings: AuthSettings = {
  enableEmailPasswordLogin: true,
  enableEmailCodeLogin: false,
  enableMobileOtpLogin: false,
  enableGoogleLogin: false,
  defaultSignInMethod: "emailPassword",
  vendorEnableEmailPasswordLogin: true,
  vendorEnableEmailCodeLogin: true,
  vendorDefaultSignInMethod: "emailPassword",
  googleClientId: "",
  googleRedirectUri: "",
  maskedGoogleClientSecret: "",
  twilioAccountSid: "",
  twilioVerifyServiceSid: "",
  maskedTwilioAuthToken: "",
  mobileOtpProvider: "fast2sms",
  fast2smsSenderId: "",
  maskedFast2smsApiKey: "",
  twofactorTemplateName: "",
  maskedTwofactorApiKey: "",
};

export default function LoginMethodsAdminClient() {
  const [settings, setSettings] = useState<AuthSettings>(defaultSettings);
  const [googleClientSecret, setGoogleClientSecret] = useState("");
  const [twilioAuthToken, setTwilioAuthToken] = useState("");
  const [fast2smsApiKey, setFast2smsApiKey] = useState("");
  const [twofactorApiKey, setTwofactorApiKey] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setError("");
    const res = await fetch("/api/admin/auth-settings", { cache: "no-store" });
    const json = await readJsonSafe(res);
    if (!res.ok || json.error) {
      setError(json.error || "Unable to load login settings.");
      return;
    }
    setSettings({ ...defaultSettings, ...(json.settings || {}) });
  };

  useEffect(() => {
    void load();
  }, []);

  const save = async () => {
    setSaving(true);
    setMessage("");
    setError("");
    try {
      const res = await fetch("/api/admin/auth-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...settings,
          googleClientSecret,
          twilioAuthToken,
          fast2smsApiKey,
          twofactorApiKey,
        }),
      });
      const json = await readJsonSafe(res);
      if (!res.ok || json.error) {
        throw new Error(json.error || "Unable to save login settings.");
      }
      setSettings({ ...defaultSettings, ...(json.settings || {}) });
      setGoogleClientSecret("");
      setTwilioAuthToken("");
      setFast2smsApiKey("");
      setTwofactorApiKey("");
      setMessage("Login methods saved.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save login settings.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="admin__panel">
      <div className="admin__form">
        <h3>User Login Methods</h3>
        <label style={{ display: "flex", alignItems: "center", gap: "0.45rem" }}>
          <input
            type="checkbox"
            checked={settings.enableEmailPasswordLogin}
            onChange={(e) =>
              setSettings((prev) => ({ ...prev, enableEmailPasswordLogin: e.target.checked }))
            }
          />
          Email + Password
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: "0.45rem" }}>
          <input
            type="checkbox"
            checked={settings.enableEmailCodeLogin}
            onChange={(e) =>
              setSettings((prev) => ({ ...prev, enableEmailCodeLogin: e.target.checked }))
            }
          />
          Email + Password + Verification Code
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: "0.45rem" }}>
          <input
            type="checkbox"
            checked={settings.enableMobileOtpLogin}
            onChange={(e) =>
              setSettings((prev) => ({ ...prev, enableMobileOtpLogin: e.target.checked }))
            }
          />
          OTP Login
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: "0.45rem" }}>
          <input
            type="checkbox"
            checked={settings.enableGoogleLogin}
            onChange={(e) => setSettings((prev) => ({ ...prev, enableGoogleLogin: e.target.checked }))}
          />
          Google Sign-In
        </label>

        <h3>Default Sign-In Method</h3>
        <select
          value={settings.defaultSignInMethod}
          onChange={(e) =>
            setSettings((prev) => ({
              ...prev,
              defaultSignInMethod: e.target.value as DefaultMethod,
            }))
          }
        >
          <option value="emailPassword">Email + Password</option>
          <option value="emailCode">Email + Password + Code</option>
          <option value="mobileOtp">OTP Login</option>
          <option value="google">Google Sign-In</option>
        </select>

        <h3>Vendor Login Methods</h3>
        <label style={{ display: "flex", alignItems: "center", gap: "0.45rem" }}>
          <input
            type="checkbox"
            checked={settings.vendorEnableEmailPasswordLogin}
            onChange={(e) =>
              setSettings((prev) => ({ ...prev, vendorEnableEmailPasswordLogin: e.target.checked }))
            }
          />
          Vendor Email + Password
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: "0.45rem" }}>
          <input
            type="checkbox"
            checked={settings.vendorEnableEmailCodeLogin}
            onChange={(e) =>
              setSettings((prev) => ({ ...prev, vendorEnableEmailCodeLogin: e.target.checked }))
            }
          />
          Vendor Email + Password + Verification Code
        </label>
        <select
          value={settings.vendorDefaultSignInMethod}
          onChange={(e) =>
            setSettings((prev) => ({
              ...prev,
              vendorDefaultSignInMethod: e.target.value as "emailPassword" | "emailCode",
            }))
          }
        >
          <option value="emailPassword">Vendor Email + Password</option>
          <option value="emailCode">Vendor Email + Password + Code</option>
        </select>

        <h3>Google Sign-In</h3>
        <input
          value={settings.googleClientId}
          onChange={(e) => setSettings((prev) => ({ ...prev, googleClientId: e.target.value }))}
          placeholder="Google Client ID"
        />
        <input
          value={googleClientSecret}
          onChange={(e) => setGoogleClientSecret(e.target.value)}
          placeholder={`Google Client Secret (${settings.maskedGoogleClientSecret || "not set"})`}
        />
        <input
          value={settings.googleRedirectUri}
          onChange={(e) => setSettings((prev) => ({ ...prev, googleRedirectUri: e.target.value }))}
          placeholder="Google Redirect URI"
        />

        <h3>OTP Provider</h3>
        <select
          value={settings.mobileOtpProvider}
          onChange={(e) =>
            setSettings((prev) => ({ ...prev, mobileOtpProvider: e.target.value as OtpProvider }))
          }
        >
          <option value="fast2sms">Fast2SMS</option>
          <option value="twilio">Twilio Verify</option>
          <option value="twofactor">2Factor</option>
        </select>

        <h3>Twilio Verify</h3>
        <input
          value={settings.twilioAccountSid}
          onChange={(e) => setSettings((prev) => ({ ...prev, twilioAccountSid: e.target.value }))}
          placeholder="Twilio Account SID"
        />
        <input
          value={twilioAuthToken}
          onChange={(e) => setTwilioAuthToken(e.target.value)}
          placeholder={`Twilio Auth Token (${settings.maskedTwilioAuthToken || "not set"})`}
        />
        <input
          value={settings.twilioVerifyServiceSid}
          onChange={(e) =>
            setSettings((prev) => ({ ...prev, twilioVerifyServiceSid: e.target.value }))
          }
          placeholder="Twilio Verify Service SID"
        />

        <h3>Fast2SMS</h3>
        <input
          value={fast2smsApiKey}
          onChange={(e) => setFast2smsApiKey(e.target.value)}
          placeholder={`Fast2SMS API Key (${settings.maskedFast2smsApiKey || "not set"})`}
        />
        <input
          value={settings.fast2smsSenderId}
          onChange={(e) => setSettings((prev) => ({ ...prev, fast2smsSenderId: e.target.value }))}
          placeholder="Fast2SMS Sender ID"
        />

        <h3>2Factor</h3>
        <input
          value={twofactorApiKey}
          onChange={(e) => setTwofactorApiKey(e.target.value)}
          placeholder={`2Factor API Key (${settings.maskedTwofactorApiKey || "not set"})`}
        />
        <input
          value={settings.twofactorTemplateName}
          onChange={(e) =>
            setSettings((prev) => ({ ...prev, twofactorTemplateName: e.target.value }))
          }
          placeholder="2Factor Template Name"
        />

        <button className="primary" onClick={save} disabled={saving}>
          {saving ? "Saving..." : "Save Login Settings"}
        </button>
      </div>

      {message ? <div className="admin__alert admin__alert--success">{message}</div> : null}
      {error ? <div className="admin__alert admin__alert--error">{error}</div> : null}
    </section>
  );
}

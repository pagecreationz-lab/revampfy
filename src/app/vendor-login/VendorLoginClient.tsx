"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { readJsonSafe } from "@/lib/httpClient";

type Mode = "password" | "emailCode";

export default function VendorLoginClient({ nextPath }: { nextPath: string }) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [forgotMode, setForgotMode] = useState(false);
  const [resetCodeSent, setResetCodeSent] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [methods, setMethods] = useState({
    emailPassword: true,
    emailCode: true,
    defaultSignInMethod: "password" as "password" | "emailCode",
  });
  const [methodsLoading, setMethodsLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const loadVendorMethods = async () => {
      try {
        const res = await fetch("/api/auth/vendor-settings", { cache: "no-store" });
        const json = await readJsonSafe(res);
        if (!res.ok || json.error) return;
        setMethods({
          emailPassword: Boolean(json?.methods?.emailPassword),
          emailCode: Boolean(json?.methods?.emailCode),
          defaultSignInMethod: json?.defaultSignInMethod === "emailCode" ? "emailCode" : "password",
        });
        if (json?.defaultSignInMethod === "emailCode") {
          setMode("emailCode");
        }
      } catch {
        // ignore settings load failure
      } finally {
        setMethodsLoading(false);
      }
    };
    void loadVendorMethods();
  }, []);

  const loginWithPassword = async () => {
    const res = await fetch("/api/auth/vendor-login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const json = await readJsonSafe(res);
    if (!res.ok || json.error) {
      throw new Error(json.error || "Vendor login failed.");
    }
  };

  const requestCode = async () => {
    const res = await fetch("/api/auth/vendor-email/request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const json = await readJsonSafe(res);
    if (!res.ok || json.error) {
      throw new Error(json.error || "Unable to send verification code.");
    }
    setCodeSent(true);
  };

  const verifyCode = async () => {
    const res = await fetch("/api/auth/vendor-email/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, code }),
    });
    const json = await readJsonSafe(res);
    if (!res.ok || json.error) {
      throw new Error(json.error || "Verification failed.");
    }
  };

  const requestResetCode = async () => {
    const res = await fetch("/api/auth/vendor-password/request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const json = await readJsonSafe(res);
    if (!res.ok || json.error) throw new Error(json.error || "Unable to send reset code.");
    setResetCodeSent(true);
  };

  const resetPasswordWithCode = async () => {
    const res = await fetch("/api/auth/vendor-password/reset", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, code, newPassword }),
    });
    const json = await readJsonSafe(res);
    if (!res.ok || json.error) throw new Error(json.error || "Unable to reset password.");
  };

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      if (forgotMode) {
        if (!resetCodeSent) {
          await requestResetCode();
          return;
        }
        await resetPasswordWithCode();
        setForgotMode(false);
        setResetCodeSent(false);
        setCode("");
        setNewPassword("");
        setMessage("Password reset successful. Please login with new password.");
        return;
      }

      if (mode === "password") {
        await loginWithPassword();
      } else if (!codeSent) {
        await requestCode();
      } else {
        await verifyCode();
      }

      if (mode === "password" || (mode === "emailCode" && codeSent && code.trim())) {
        router.push(nextPath || "/vendor-admin");
        router.refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Vendor login failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="container" style={{ padding: "2rem 1rem", maxWidth: 620 }}>
      <h1>Vendor Login</h1>
      <p className="hero__subtext">Access only your vendor dashboard with role-based authentication.</p>

      {!forgotMode ? (
        <div style={{ display: "flex", gap: "0.6rem", marginBottom: "0.85rem", flexWrap: "wrap" }}>
          {methods.emailPassword ? (
            <button
              type="button"
              className={mode === "password" ? "primary" : "secondary"}
              onClick={() => {
                setMode("password");
                setCodeSent(false);
                setCode("");
                setError("");
              }}
            >
              Email Login
            </button>
          ) : null}
          {methods.emailCode ? (
            <button
              type="button"
              className={mode === "emailCode" ? "primary" : "secondary"}
              onClick={() => {
                setMode("emailCode");
                setCodeSent(false);
                setCode("");
                setError("");
              }}
            >
              Email Login
            </button>
          ) : null}
        </div>
      ) : null}
      {methodsLoading ? <p className="hero__subtext">Loading login methods...</p> : null}

      <form className="admin__form" onSubmit={onSubmit}>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Vendor email"
          required
        />
        {!forgotMode ? (
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            required
          />
        ) : null}
        {(mode === "emailCode" && codeSent) || (forgotMode && resetCodeSent) ? (
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="6-digit verification code"
            required
          />
        ) : null}
        {forgotMode && resetCodeSent ? (
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="New password"
            required
          />
        ) : null}
        <button className="primary" type="submit" disabled={busy}>
          {busy
            ? "Please wait..."
            : forgotMode
              ? resetCodeSent
                ? "Verify Code & Reset Password"
                : "Send Password Reset Code"
              : mode === "password"
                ? "Login"
                : codeSent
                  ? "Verify & Login"
                  : "Send Verification Code"}
        </button>
      </form>
      <div style={{ marginTop: "0.6rem", display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
        <button
          type="button"
          className="ghost"
          onClick={() => {
            setForgotMode((prev) => !prev);
            setResetCodeSent(false);
            setCode("");
            setNewPassword("");
            setError("");
          }}
        >
          {forgotMode ? "Back To Login" : "Forgot Password"}
        </button>
        <button
          type="button"
          className="secondary"
          onClick={() => {
            router.push("/login");
          }}
        >
          Back to Login
        </button>
      </div>
      {error ? <p style={{ color: "#b73333", marginTop: "0.75rem" }}>{error}</p> : null}
      {message ? <p style={{ color: "#0c8f4f", marginTop: "0.75rem" }}>{message}</p> : null}
      {mode === "emailCode" && codeSent ? (
        <p style={{ marginTop: "0.5rem" }}>Verification code sent. Check vendor email inbox.</p>
      ) : null}
      {forgotMode && resetCodeSent ? (
        <p style={{ marginTop: "0.5rem" }}>Reset code sent. Enter code and set a new password.</p>
      ) : null}
    </main>
  );
}

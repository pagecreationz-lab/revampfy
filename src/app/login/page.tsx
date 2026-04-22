"use client";

import { useEffect, useMemo, useState } from "react";
import { Header } from "@/components/Header";
import { Topbar } from "@/components/Topbar";
import { readJsonSafe } from "@/lib/httpClient";

type LoginMode = "emailPassword" | "emailCode" | "mobileOtp" | "google";
type AuthMethods = { emailPassword: boolean; emailCode: boolean; mobileOtp: boolean; google: boolean };
type AuthDiagnostics = {
  mobileOtpEnabled: boolean;
  mobileOtpConfigured: boolean;
  googleEnabled: boolean;
  googleConfigured: boolean;
};

export default function LoginPage() {
  const [mode, setMode] = useState<LoginMode>("emailCode");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [mobile, setMobile] = useState("");
  const [mobileOtp, setMobileOtp] = useState("");
  const [mobileOtpSent, setMobileOtpSent] = useState(false);
  const [awaitingVerification, setAwaitingVerification] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [loading, setLoading] = useState(false);
  const [nextPath, setNextPath] = useState("/user-dashboard");
  const [methods, setMethods] = useState<AuthMethods>({
    emailPassword: false,
    emailCode: true,
    mobileOtp: false,
    google: true,
  });
  const [diagnostics, setDiagnostics] = useState<AuthDiagnostics>({
    mobileOtpEnabled: false,
    mobileOtpConfigured: false,
    googleEnabled: false,
    googleConfigured: false,
  });

  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.get("expired")) {
      setError("Session expired. Please login again.");
    }
    const next = url.searchParams.get("next");
    if (next?.startsWith("/")) {
      setNextPath(next);
    }
    const routeError = url.searchParams.get("error");
    if (routeError) {
      setError(routeError);
    }
  }, []);

  useEffect(() => {
    const loadMethods = async () => {
      try {
        const res = await fetch("/api/auth/settings");
        const json = await readJsonSafe(res);
        const nextMethods: AuthMethods = {
          emailPassword: Boolean(json?.methods?.emailPassword),
          emailCode: Boolean(json?.methods?.emailCode),
          mobileOtp: Boolean(json?.methods?.mobileOtp),
          google: Boolean(json?.methods?.google),
        };
        const nextDiagnostics: AuthDiagnostics = {
          mobileOtpEnabled: Boolean(json?.diagnostics?.mobileOtpEnabled),
          mobileOtpConfigured: Boolean(json?.diagnostics?.mobileOtpConfigured),
          googleEnabled: Boolean(json?.diagnostics?.googleEnabled),
          googleConfigured: Boolean(json?.diagnostics?.googleConfigured),
        };
        setMethods(nextMethods);
        setDiagnostics(nextDiagnostics);
        if (nextMethods.emailPassword) setMode("emailPassword");
        else if (nextMethods.emailCode) setMode("emailCode");
        else if (nextMethods.mobileOtp) setMode("mobileOtp");
        else if (nextMethods.google) setMode("google");
      } catch {
        setMethods({ emailPassword: false, emailCode: true, mobileOtp: false, google: true });
        setDiagnostics({
          mobileOtpEnabled: false,
          mobileOtpConfigured: false,
          googleEnabled: false,
          googleConfigured: false,
        });
      }
    };
    void loadMethods();
  }, []);

  const loginModes = useMemo(() => {
    const modes: Array<{ key: LoginMode; label: string }> = [];
    if (methods.emailPassword) modes.push({ key: "emailPassword", label: "Email + Password" });
    if (methods.emailCode) modes.push({ key: "emailCode", label: "Email + Password + Code" });
    if (methods.mobileOtp) modes.push({ key: "mobileOtp", label: "Mobile OTP" });
    if (methods.google) modes.push({ key: "google", label: "Google Sign-In" });
    return modes;
  }, [methods]);

  const completeLogin = (role?: string) => {
    if (role === "admin") {
      window.location.href = nextPath === "/user-dashboard" ? "/admin" : nextPath;
      return;
    }
    window.location.href = nextPath;
  };

  const handlePasswordLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    setInfo("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          password,
          authMethod: mode === "emailPassword" ? "password_only" : "password_with_code",
        }),
      });
      const json = await readJsonSafe(res);
      if (!res.ok) {
        throw new Error(String(json.error || "Login failed."));
      }
      if (Boolean(json.requiresVerification) && mode === "emailCode") {
        setAwaitingVerification(true);
        setInfo(String(json.message || "Verification code sent to your email."));
        return;
      }
      completeLogin(typeof json.role === "string" ? json.role : undefined);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed.");
    } finally {
      setLoading(false);
    }
  };

  const verifyCode = async () => {
    setError("");
    setInfo("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/email/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code }),
      });
      const json = await readJsonSafe(res);
      if (!res.ok) {
        throw new Error(String(json.error || "Verification failed."));
      }
      completeLogin(typeof json.role === "string" ? json.role : undefined);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verification failed.");
    } finally {
      setLoading(false);
    }
  };

  const googleSignIn = () => {
    const next = encodeURIComponent(nextPath);
    window.location.href = `/api/auth/google?next=${next}`;
  };

  const requestMobileOtp = async () => {
    setError("");
    setInfo("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/otp/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mobile }),
      });
      const json = await readJsonSafe(res);
      if (!res.ok) {
        throw new Error(String(json.error || "Unable to send mobile OTP."));
      }
      setMobileOtpSent(true);
      setInfo(String(json.message || "OTP sent successfully."));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to send mobile OTP.");
    } finally {
      setLoading(false);
    }
  };

  const verifyMobileOtp = async () => {
    setError("");
    setInfo("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/otp/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ otp: mobileOtp }),
      });
      const json = await readJsonSafe(res);
      if (!res.ok) {
        throw new Error(String(json.error || "OTP verification failed."));
      }
      completeLogin("customer");
    } catch (err) {
      setError(err instanceof Error ? err.message : "OTP verification failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Topbar />
      <Header />
      <main>
        <section className="section">
          <div className="admin container">
            <h1>User Login</h1>
            <p className="hero__subtext">Login is required for checkout and payment.</p>
            <p className="hero__subtext">
              Admin? <a href="/admin-login">Use Admin Login</a>
            </p>
            <div className="admin__panel">
              <div className="login-modes">
                {loginModes.map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    className={mode === item.key ? "primary" : "secondary"}
                    onClick={() => {
                      setMode(item.key);
                      setError("");
                      setInfo("");
                      setAwaitingVerification(false);
                      setCode("");
                      setMobileOtpSent(false);
                      setMobileOtp("");
                    }}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
              {!loginModes.length ? (
                <div className="admin__alert admin__alert--error">
                  All login methods are currently disabled. Please contact admin support.
                </div>
              ) : null}
              {diagnostics.mobileOtpEnabled && !diagnostics.mobileOtpConfigured ? (
                <div className="admin__alert admin__alert--error">
                  Mobile OTP is enabled in CMS, but Twilio config is incomplete. Please add Twilio
                  Account SID, Auth Token, and Verify Service SID in Admin settings.
                </div>
              ) : null}

              {(mode === "emailPassword" || mode === "emailCode") ? (
                <form className="admin__form" onSubmit={handlePasswordLogin}>
                  {!(awaitingVerification && mode === "emailCode") ? (
                    <>
                      <input
                        type="email"
                        placeholder="Email"
                        value={email}
                        onChange={(event) => setEmail(event.target.value)}
                        required
                      />
                      <input
                        type="password"
                        placeholder="Password"
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                        required
                      />
                      <button className="primary" type="submit" disabled={loading}>
                        {loading ? "Signing in..." : "Login"}
                      </button>
                    </>
                  ) : mode === "emailCode" ? (
                    <>
                      <input
                        type="text"
                        placeholder="Enter 6-digit code"
                        value={code}
                        onChange={(event) => setCode(event.target.value)}
                        maxLength={6}
                      />
                      <button className="primary" type="button" onClick={verifyCode} disabled={loading}>
                        {loading ? "Verifying..." : "Verify & Login"}
                      </button>
                      <button
                        className="secondary"
                        type="button"
                        onClick={() => {
                          setAwaitingVerification(false);
                          setCode("");
                          setInfo("");
                        }}
                      >
                        Change email/password
                      </button>
                    </>
                  ) : null}
                </form>
              ) : null}

              {mode === "mobileOtp" && methods.mobileOtp ? (
                <div className="admin__form">
                  {!mobileOtpSent ? (
                    <>
                      <input
                        type="tel"
                        placeholder="Mobile number (e.g. +918248003564)"
                        value={mobile}
                        onChange={(event) => setMobile(event.target.value)}
                      />
                      <button className="primary" type="button" onClick={requestMobileOtp} disabled={loading}>
                        {loading ? "Sending OTP..." : "Send OTP"}
                      </button>
                    </>
                  ) : (
                    <>
                      <input
                        type="text"
                        placeholder="Enter OTP"
                        value={mobileOtp}
                        onChange={(event) => setMobileOtp(event.target.value)}
                        maxLength={8}
                      />
                      <button className="primary" type="button" onClick={verifyMobileOtp} disabled={loading}>
                        {loading ? "Verifying..." : "Verify OTP"}
                      </button>
                      <button
                        className="secondary"
                        type="button"
                        onClick={() => {
                          setMobileOtpSent(false);
                          setMobileOtp("");
                          setInfo("");
                        }}
                      >
                        Change mobile number
                      </button>
                    </>
                  )}
                </div>
              ) : null}

              {mode === "google" && methods.google ? (
                <div className="admin__form">
                  <button className="primary" type="button" onClick={googleSignIn}>
                    Sign in with Google
                  </button>
                </div>
              ) : null}

              {info ? <div className="admin__alert admin__alert--success">{info}</div> : null}
              {error ? <div className="admin__alert admin__alert--error">{error}</div> : null}
            </div>
          </div>
        </section>
      </main>
    </>
  );
}

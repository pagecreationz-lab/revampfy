"use client";

import { useEffect, useMemo, useState } from "react";
import { Header } from "@/components/Header";
import { Topbar } from "@/components/Topbar";

type LoginMode = "emailPassword" | "emailCode" | "google";
type AuthMethods = { emailPassword: boolean; emailCode: boolean; google: boolean };

export default function LoginPage() {
  const [mode, setMode] = useState<LoginMode>("emailCode");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [awaitingVerification, setAwaitingVerification] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [loading, setLoading] = useState(false);
  const [nextPath, setNextPath] = useState("/user-dashboard");
  const [methods, setMethods] = useState<AuthMethods>({
    emailPassword: false,
    emailCode: true,
    google: true,
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
        const json = await res.json();
        const nextMethods: AuthMethods = {
          emailPassword: Boolean(json?.methods?.emailPassword),
          emailCode: Boolean(json?.methods?.emailCode),
          google: Boolean(json?.methods?.google),
        };
        setMethods(nextMethods);
        if (nextMethods.emailPassword) {
          setMode("emailPassword");
        } else if (!nextMethods.emailCode && nextMethods.google) {
          setMode("google");
        }
      } catch {
        setMethods({ emailPassword: false, emailCode: true, google: true });
      }
    };
    void loadMethods();
  }, []);

  const loginModes = useMemo(() => {
    const modes: Array<{ key: LoginMode; label: string }> = [];
    if (methods.emailPassword) modes.push({ key: "emailPassword", label: "Email + Password" });
    if (methods.emailCode) modes.push({ key: "emailCode", label: "Email + Password + Code" });
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
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || "Login failed.");
      }
      if (json.requiresVerification && mode === "emailCode") {
        setAwaitingVerification(true);
        setInfo(json.message || "Verification code sent to your email.");
        return;
      }
      completeLogin(json.role);
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
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || "Verification failed.");
      }
      completeLogin(json.role);
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

  return (
    <>
      <Topbar />
      <Header />
      <main>
        <section className="section">
          <div className="admin container">
            <h1>User Login</h1>
            <p className="hero__subtext">Login is required for checkout and payment.</p>
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

"use client";

import { useEffect, useState } from "react";
import { Header } from "@/components/Header";
import { Topbar } from "@/components/Topbar";

export default function AdminLoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [nextPath, setNextPath] = useState("/admin");

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

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/admin-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || "Admin login failed.");
      }
      window.location.href = nextPath;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Admin login failed.");
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
            <h1>Admin Login</h1>
            <p className="hero__subtext">Admin portal access with email and password only.</p>
            <div className="admin__panel">
              <form className="admin__form" onSubmit={handleLogin}>
                <input
                  type="email"
                  placeholder="Admin email"
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
              </form>
              {error ? <div className="admin__alert admin__alert--error">{error}</div> : null}
            </div>
          </div>
        </section>
      </main>
    </>
  );
}


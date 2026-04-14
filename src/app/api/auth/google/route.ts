import { NextResponse } from "next/server";
import { getAuthSettings } from "@/lib/authSettings";
import crypto from "crypto";

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";

function safeNextPath(value: string | null | undefined) {
  if (!value || !value.startsWith("/")) return "/user-dashboard";
  return value;
}

function buildRedirectUrl(request: Request, configured: string) {
  if (configured) return configured;
  const url = new URL(request.url);
  return `${url.origin}/api/auth/google/callback`;
}

function buildAuthUrl(request: Request, next: string, state: string, clientId: string, redirectUri: string) {
  const url = new URL(GOOGLE_AUTH_URL);
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "openid email profile");
  url.searchParams.set("prompt", "select_account");
  url.searchParams.set("state", state);
  return url.toString();
}

export async function GET(request: Request) {
  const settings = await getAuthSettings();
  if (!settings.enableGoogleLogin) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("error", "Google login is disabled.");
    return NextResponse.redirect(loginUrl);
  }
  if (!settings.googleClientId || !settings.googleClientSecret) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("error", "Google login is not configured in admin.");
    return NextResponse.redirect(loginUrl);
  }

  const url = new URL(request.url);
  const next = safeNextPath(url.searchParams.get("next"));
  const state = crypto.randomBytes(18).toString("hex");
  const redirectUri = buildRedirectUrl(request, settings.googleRedirectUri);
  const authUrl = buildAuthUrl(request, next, state, settings.googleClientId, redirectUri);

  const response = NextResponse.redirect(authUrl);
  response.cookies.set("pcgs_google_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 10,
  });
  response.cookies.set("pcgs_google_next", next, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 10,
  });
  return response;
}

export async function POST(request: Request) {
  const settings = await getAuthSettings();
  if (!settings.enableGoogleLogin || !settings.googleClientId || !settings.googleClientSecret) {
    return NextResponse.json({ error: "Google login is not configured." }, { status: 400 });
  }

  const payload = await request.json().catch(() => ({}));
  const next = safeNextPath(typeof payload?.next === "string" ? payload.next : "/user-dashboard");
  const state = crypto.randomBytes(18).toString("hex");
  const redirectUri = buildRedirectUrl(request, settings.googleRedirectUri);
  const authUrl = buildAuthUrl(request, next, state, settings.googleClientId, redirectUri);

  const response = NextResponse.json({ ok: true, authUrl });
  response.cookies.set("pcgs_google_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 10,
  });
  response.cookies.set("pcgs_google_next", next, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 10,
  });
  return response;
}


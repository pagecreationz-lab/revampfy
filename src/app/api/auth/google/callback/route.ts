import { NextResponse } from "next/server";
import { createSessionToken, getAdminUsers } from "@/lib/auth";
import { getAuthSettings } from "@/lib/authSettings";
import { ensureCustomerUserByEmail } from "@/lib/customerData";

const MAX_AGE = 60 * 60 * 12;

function safeNextPath(value: string | null | undefined) {
  if (!value || !value.startsWith("/")) return "/user-dashboard";
  return value;
}

function readCookie(request: Request, key: string): string {
  const cookie = request.headers.get("cookie") || "";
  const match = cookie.match(new RegExp(`${key}=([^;]+)`));
  return decodeURIComponent(match?.[1] || "");
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const oauthError = url.searchParams.get("error");

  const settings = await getAuthSettings();
  const loginUrl = new URL("/login", request.url);

  if (oauthError) {
    loginUrl.searchParams.set("error", "Google authentication was cancelled.");
    return NextResponse.redirect(loginUrl);
  }
  if (!settings.enableGoogleLogin) {
    loginUrl.searchParams.set("error", "Google login is disabled.");
    return NextResponse.redirect(loginUrl);
  }
  if (!settings.googleClientId || !settings.googleClientSecret) {
    loginUrl.searchParams.set("error", "Google login is not configured.");
    return NextResponse.redirect(loginUrl);
  }
  if (!code || !state) {
    loginUrl.searchParams.set("error", "Missing Google OAuth callback data.");
    return NextResponse.redirect(loginUrl);
  }

  const cookieState = readCookie(request, "pcgs_google_state");
  const nextPath = safeNextPath(readCookie(request, "pcgs_google_next"));

  if (!cookieState || cookieState !== state) {
    loginUrl.searchParams.set("error", "Google login session expired. Try again.");
    return NextResponse.redirect(loginUrl);
  }

  try {
    const redirectUri = settings.googleRedirectUri || `${url.origin}/api/auth/google/callback`;

    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: settings.googleClientId,
        client_secret: settings.googleClientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });
    const tokenJson = (await tokenRes.json()) as { id_token?: string; access_token?: string };
    if (!tokenRes.ok || !tokenJson.id_token) {
      throw new Error("Unable to exchange Google OAuth code.");
    }

    const verifyRes = await fetch(
      `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(tokenJson.id_token)}`
    );
    const verifyJson = (await verifyRes.json()) as {
      email?: string;
      email_verified?: string | boolean;
      name?: string;
      aud?: string;
    };
    if (!verifyRes.ok || !verifyJson.email) {
      throw new Error("Unable to verify Google account.");
    }
    if (verifyJson.aud && verifyJson.aud !== settings.googleClientId) {
      throw new Error("Google OAuth audience mismatch.");
    }
    if (!(verifyJson.email_verified === true || verifyJson.email_verified === "true")) {
      throw new Error("Google account email is not verified.");
    }

    const email = verifyJson.email.toLowerCase();
    const adminUser = getAdminUsers().find((item) => item.email.toLowerCase() === email);
    const role = adminUser ? "admin" : "customer";
    if (role === "customer") {
      await ensureCustomerUserByEmail(email, verifyJson.name);
    }

    const exp = Date.now() + MAX_AGE * 1000;
    const token = createSessionToken({ email, role, exp });
    const redirectPath = role === "admin" && nextPath === "/user-dashboard" ? "/admin" : nextPath;
    const response = NextResponse.redirect(new URL(redirectPath, request.url));
    response.cookies.set("pcgs_admin_session", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: MAX_AGE,
    });
    response.cookies.set("pcgs_google_state", "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    });
    response.cookies.set("pcgs_google_next", "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    });
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Google login failed.";
    loginUrl.searchParams.set("error", message);
    const response = NextResponse.redirect(loginUrl);
    response.cookies.set("pcgs_google_state", "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    });
    response.cookies.set("pcgs_google_next", "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    });
    return response;
  }
}


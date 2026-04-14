import "server-only";
import crypto from "crypto";

const SESSION_COOKIE = "pcgs_admin_session";
const DEMO_USER = {
  email: "demo@pcgs.in",
  passwordHash: "ff96673205dc722320598ebf8f88325b2ac56922d5a2164b5765868274bc0d73",
  role: "admin",
};

type AdminUser = {
  email: string;
  passwordHash: string;
  role: string;
};

export function getAdminUsers(): AdminUser[] {
  const raw = process.env.ADMIN_USERS;
  if (!raw) {
    return [DEMO_USER];
  }

  try {
    const users = JSON.parse(raw) as AdminUser[];
    const normalized = users.map((user) => ({
      ...user,
      role: user.role || "admin",
    }));
    return normalized.length ? normalized : [DEMO_USER];
  } catch {
    return [DEMO_USER];
  }
}

function getAuthSecret(): string {
  return process.env.AUTH_SECRET || "pcgs-demo-secret-change-in-production";
}

export function hashPassword(password: string): string {
  return crypto.createHash("sha256").update(password).digest("hex");
}

export function verifyPassword(password: string, hash: string): boolean {
  const computed = hashPassword(password);
  return crypto.timingSafeEqual(Buffer.from(computed), Buffer.from(hash));
}

function sign(payload: string): string {
  const secret = getAuthSecret();
  return crypto.createHmac("sha256", secret).update(payload).digest("hex");
}

export function createSessionToken(payload: {
  email: string;
  role: string;
  exp: number;
}): string {
  const data = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = sign(data);
  return `${data}.${signature}`;
}

export function verifySessionToken(token?: string): {
  email: string;
  role: string;
  exp: number;
} | null {
  if (!token) return null;
  const [data, signature] = token.split(".");
  if (!data || !signature) return null;

  const expected = sign(data);
  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
    return null;
  }

  try {
    const payload = JSON.parse(Buffer.from(data, "base64url").toString("utf8"));
    if (typeof payload.exp !== "number" || payload.exp < Date.now()) {
      return null;
    }

    return payload as { email: string; role: string; exp: number };
  } catch {
    return null;
  }
}

export function readSessionFromRequest(request: Request) {
  const cookie = request.headers.get("cookie") || "";
  const match = cookie.match(new RegExp(`${SESSION_COOKIE}=([^;]+)`));
  return match?.[1];
}

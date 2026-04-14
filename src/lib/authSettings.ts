import "server-only";
import fs from "fs/promises";
import path from "path";

export type AuthSettings = {
  enableEmailPasswordLogin: boolean;
  enableEmailCodeLogin: boolean;
  enableGoogleLogin: boolean;
  googleClientId: string;
  googleClientSecret: string;
  googleRedirectUri: string;
};

const settingsPath = path.join(process.cwd(), "data", "auth-settings.json");

function fromEnv(): AuthSettings {
  return {
    enableEmailPasswordLogin: false,
    enableEmailCodeLogin: true,
    enableGoogleLogin: true,
    googleClientId: process.env.GOOGLE_CLIENT_ID || "",
    googleClientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
    googleRedirectUri: process.env.GOOGLE_REDIRECT_URI || "",
  };
}

export async function getAuthSettings(): Promise<AuthSettings> {
  const defaults = fromEnv();
  try {
    const raw = await fs.readFile(settingsPath, "utf8");
    const parsed = JSON.parse(raw) as Partial<AuthSettings>;
    return {
      enableEmailPasswordLogin:
        typeof parsed.enableEmailPasswordLogin === "boolean"
          ? parsed.enableEmailPasswordLogin
          : defaults.enableEmailPasswordLogin,
      enableEmailCodeLogin:
        typeof parsed.enableEmailCodeLogin === "boolean"
          ? parsed.enableEmailCodeLogin
          : defaults.enableEmailCodeLogin,
      enableGoogleLogin:
        typeof parsed.enableGoogleLogin === "boolean"
          ? parsed.enableGoogleLogin
          : defaults.enableGoogleLogin,
      googleClientId: parsed.googleClientId || defaults.googleClientId,
      googleClientSecret: parsed.googleClientSecret || defaults.googleClientSecret,
      googleRedirectUri: parsed.googleRedirectUri || defaults.googleRedirectUri,
    };
  } catch {
    return defaults;
  }
}

export async function saveAuthSettings(next: Partial<AuthSettings>): Promise<AuthSettings> {
  const current = await getAuthSettings();
  const merged: AuthSettings = {
    ...current,
    ...next,
    enableEmailPasswordLogin:
      typeof next.enableEmailPasswordLogin === "boolean"
        ? next.enableEmailPasswordLogin
        : current.enableEmailPasswordLogin,
    enableEmailCodeLogin:
      typeof next.enableEmailCodeLogin === "boolean"
        ? next.enableEmailCodeLogin
        : current.enableEmailCodeLogin,
    enableGoogleLogin:
      typeof next.enableGoogleLogin === "boolean"
        ? next.enableGoogleLogin
        : current.enableGoogleLogin,
    googleClientId:
      typeof next.googleClientId === "string" ? next.googleClientId.trim() : current.googleClientId,
    googleClientSecret:
      typeof next.googleClientSecret === "string"
        ? next.googleClientSecret.trim()
        : current.googleClientSecret,
    googleRedirectUri:
      typeof next.googleRedirectUri === "string"
        ? next.googleRedirectUri.trim()
        : current.googleRedirectUri,
  };

  await fs.mkdir(path.dirname(settingsPath), { recursive: true });
  await fs.writeFile(settingsPath, JSON.stringify(merged, null, 2), "utf8");
  return merged;
}

export function maskSecret(secret: string): string {
  if (!secret) return "";
  if (secret.length <= 6) return "******";
  return `${secret.slice(0, 2)}${"*".repeat(Math.max(4, secret.length - 4))}${secret.slice(-2)}`;
}

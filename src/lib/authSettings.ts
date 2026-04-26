import "server-only";
import fs from "fs/promises";
import path from "path";

export type AuthSettings = {
  enableEmailPasswordLogin: boolean;
  enableEmailCodeLogin: boolean;
  enableMobileOtpLogin: boolean;
  enableGoogleLogin: boolean;
  googleClientId: string;
  googleClientSecret: string;
  googleRedirectUri: string;
  twilioAccountSid: string;
  twilioAuthToken: string;
  twilioVerifyServiceSid: string;
};

const settingsPath = path.join(process.cwd(), "data", "auth-settings.json");

function cleanSecret(value: string): string {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1).trim();
  }
  return trimmed;
}

function fromEnv(): AuthSettings {
  return {
    enableEmailPasswordLogin: false,
    enableEmailCodeLogin: true,
    enableMobileOtpLogin: false,
    enableGoogleLogin: true,
    googleClientId: cleanSecret(process.env.GOOGLE_CLIENT_ID || ""),
    googleClientSecret: cleanSecret(process.env.GOOGLE_CLIENT_SECRET || ""),
    googleRedirectUri: cleanSecret(process.env.GOOGLE_REDIRECT_URI || ""),
    twilioAccountSid: cleanSecret(process.env.TWILIO_ACCOUNT_SID || ""),
    twilioAuthToken: cleanSecret(process.env.TWILIO_AUTH_TOKEN || ""),
    twilioVerifyServiceSid: cleanSecret(process.env.TWILIO_VERIFY_SERVICE_SID || ""),
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
      enableMobileOtpLogin:
        typeof parsed.enableMobileOtpLogin === "boolean"
          ? parsed.enableMobileOtpLogin
          : defaults.enableMobileOtpLogin,
      enableGoogleLogin:
        typeof parsed.enableGoogleLogin === "boolean"
          ? parsed.enableGoogleLogin
          : defaults.enableGoogleLogin,
      googleClientId: parsed.googleClientId || defaults.googleClientId,
      googleClientSecret: parsed.googleClientSecret || defaults.googleClientSecret,
      googleRedirectUri: parsed.googleRedirectUri || defaults.googleRedirectUri,
      twilioAccountSid: parsed.twilioAccountSid || defaults.twilioAccountSid,
      twilioAuthToken: parsed.twilioAuthToken || defaults.twilioAuthToken,
      twilioVerifyServiceSid:
        parsed.twilioVerifyServiceSid || defaults.twilioVerifyServiceSid,
    };
  } catch {
    return defaults;
  }
}

export async function saveAuthSettings(next: Partial<AuthSettings>): Promise<AuthSettings> {
  const current = await getAuthSettings();
  const keepIfBlank = (incoming: unknown, existing: string) => {
    if (typeof incoming !== "string") return existing;
    const trimmed = cleanSecret(incoming);
    if (!trimmed && existing) return existing;
    return trimmed;
  };

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
    enableMobileOtpLogin:
      typeof next.enableMobileOtpLogin === "boolean"
        ? next.enableMobileOtpLogin
        : current.enableMobileOtpLogin,
    enableGoogleLogin:
      typeof next.enableGoogleLogin === "boolean"
        ? next.enableGoogleLogin
        : current.enableGoogleLogin,
    googleClientId:
      keepIfBlank(next.googleClientId, current.googleClientId),
    googleClientSecret:
      keepIfBlank(next.googleClientSecret, current.googleClientSecret),
    googleRedirectUri:
      keepIfBlank(next.googleRedirectUri, current.googleRedirectUri),
    twilioAccountSid:
      keepIfBlank(next.twilioAccountSid, current.twilioAccountSid),
    twilioAuthToken:
      keepIfBlank(next.twilioAuthToken, current.twilioAuthToken),
    twilioVerifyServiceSid:
      keepIfBlank(next.twilioVerifyServiceSid, current.twilioVerifyServiceSid),
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

import "server-only";
import fs from "fs/promises";
import path from "path";

export type AuthSettings = {
  enableEmailPasswordLogin: boolean;
  enableEmailCodeLogin: boolean;
  enableMobileOtpLogin: boolean;
  enableGoogleLogin: boolean;
  defaultSignInMethod: "emailPassword" | "emailCode" | "mobileOtp" | "google";
  vendorEnableEmailPasswordLogin: boolean;
  vendorEnableEmailCodeLogin: boolean;
  vendorDefaultSignInMethod: "emailPassword" | "emailCode";
  googleClientId: string;
  googleClientSecret: string;
  googleRedirectUri: string;
  twilioAccountSid: string;
  twilioAuthToken: string;
  twilioVerifyServiceSid: string;
  mobileOtpProvider: "twilio" | "fast2sms" | "twofactor";
  fast2smsApiKey: string;
  fast2smsSenderId: string;
  twofactorApiKey: string;
  twofactorTemplateName: string;
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
    defaultSignInMethod: "emailCode",
    vendorEnableEmailPasswordLogin: true,
    vendorEnableEmailCodeLogin: true,
    vendorDefaultSignInMethod: "emailPassword",
    googleClientId: cleanSecret(process.env.GOOGLE_CLIENT_ID || ""),
    googleClientSecret: cleanSecret(process.env.GOOGLE_CLIENT_SECRET || ""),
    googleRedirectUri: cleanSecret(process.env.GOOGLE_REDIRECT_URI || ""),
    twilioAccountSid: cleanSecret(process.env.TWILIO_ACCOUNT_SID || ""),
    twilioAuthToken: cleanSecret(process.env.TWILIO_AUTH_TOKEN || ""),
    twilioVerifyServiceSid: cleanSecret(process.env.TWILIO_VERIFY_SERVICE_SID || ""),
    mobileOtpProvider:
      cleanSecret(process.env.MOBILE_OTP_PROVIDER || "").toLowerCase() === "fast2sms"
        ? "fast2sms"
        : cleanSecret(process.env.MOBILE_OTP_PROVIDER || "").toLowerCase() === "twofactor"
          ? "twofactor"
          : "twilio",
    fast2smsApiKey: cleanSecret(process.env.FAST2SMS_API_KEY || ""),
    fast2smsSenderId: cleanSecret(process.env.FAST2SMS_SENDER_ID || ""),
    twofactorApiKey: cleanSecret(process.env.TWOFACTOR_API_KEY || ""),
    twofactorTemplateName: cleanSecret(process.env.TWOFACTOR_TEMPLATE_NAME || ""),
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
      defaultSignInMethod:
        parsed.defaultSignInMethod === "emailPassword" ||
        parsed.defaultSignInMethod === "emailCode" ||
        parsed.defaultSignInMethod === "mobileOtp" ||
        parsed.defaultSignInMethod === "google"
          ? parsed.defaultSignInMethod
          : defaults.defaultSignInMethod,
      vendorEnableEmailPasswordLogin:
        typeof parsed.vendorEnableEmailPasswordLogin === "boolean"
          ? parsed.vendorEnableEmailPasswordLogin
          : defaults.vendorEnableEmailPasswordLogin,
      vendorEnableEmailCodeLogin:
        typeof parsed.vendorEnableEmailCodeLogin === "boolean"
          ? parsed.vendorEnableEmailCodeLogin
          : defaults.vendorEnableEmailCodeLogin,
      vendorDefaultSignInMethod:
        parsed.vendorDefaultSignInMethod === "emailPassword" ||
        parsed.vendorDefaultSignInMethod === "emailCode"
          ? parsed.vendorDefaultSignInMethod
          : defaults.vendorDefaultSignInMethod,
      googleClientId: parsed.googleClientId || defaults.googleClientId,
      googleClientSecret: parsed.googleClientSecret || defaults.googleClientSecret,
      googleRedirectUri: parsed.googleRedirectUri || defaults.googleRedirectUri,
      twilioAccountSid: parsed.twilioAccountSid || defaults.twilioAccountSid,
      twilioAuthToken: parsed.twilioAuthToken || defaults.twilioAuthToken,
      twilioVerifyServiceSid:
        parsed.twilioVerifyServiceSid || defaults.twilioVerifyServiceSid,
      mobileOtpProvider:
        parsed.mobileOtpProvider === "fast2sms" ||
        parsed.mobileOtpProvider === "twilio" ||
        parsed.mobileOtpProvider === "twofactor"
          ? parsed.mobileOtpProvider
          : defaults.mobileOtpProvider,
      fast2smsApiKey: parsed.fast2smsApiKey || defaults.fast2smsApiKey,
      fast2smsSenderId: parsed.fast2smsSenderId || defaults.fast2smsSenderId,
      twofactorApiKey: parsed.twofactorApiKey || defaults.twofactorApiKey,
      twofactorTemplateName: parsed.twofactorTemplateName || defaults.twofactorTemplateName,
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
    defaultSignInMethod:
      next.defaultSignInMethod === "emailPassword" ||
      next.defaultSignInMethod === "emailCode" ||
      next.defaultSignInMethod === "mobileOtp" ||
      next.defaultSignInMethod === "google"
        ? next.defaultSignInMethod
        : current.defaultSignInMethod,
    vendorEnableEmailPasswordLogin:
      typeof next.vendorEnableEmailPasswordLogin === "boolean"
        ? next.vendorEnableEmailPasswordLogin
        : current.vendorEnableEmailPasswordLogin,
    vendorEnableEmailCodeLogin:
      typeof next.vendorEnableEmailCodeLogin === "boolean"
        ? next.vendorEnableEmailCodeLogin
        : current.vendorEnableEmailCodeLogin,
    vendorDefaultSignInMethod:
      next.vendorDefaultSignInMethod === "emailPassword" ||
      next.vendorDefaultSignInMethod === "emailCode"
        ? next.vendorDefaultSignInMethod
        : current.vendorDefaultSignInMethod,
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
    mobileOtpProvider:
      next.mobileOtpProvider === "fast2sms" ||
      next.mobileOtpProvider === "twilio" ||
      next.mobileOtpProvider === "twofactor"
        ? next.mobileOtpProvider
        : current.mobileOtpProvider,
    fast2smsApiKey:
      keepIfBlank(next.fast2smsApiKey, current.fast2smsApiKey),
    fast2smsSenderId:
      keepIfBlank(next.fast2smsSenderId, current.fast2smsSenderId),
    twofactorApiKey:
      keepIfBlank(next.twofactorApiKey, current.twofactorApiKey),
    twofactorTemplateName:
      keepIfBlank(next.twofactorTemplateName, current.twofactorTemplateName),
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

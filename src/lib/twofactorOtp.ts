import "server-only";
import { getAuthSettings } from "@/lib/authSettings";
import { normalizeMobileToE164 } from "@/lib/twilioVerify";

type TwoFactorSendResponse = {
  Status?: string;
  Details?: string;
};

type TwoFactorVerifyResponse = {
  Status?: string;
  Details?: string;
};

function toIndianTenDigit(mobileInput: string): string {
  const normalized = normalizeMobileToE164(mobileInput);
  if (!normalized) throw new Error("Enter a valid mobile number.");
  const digits = normalized.replace(/\D/g, "");
  const local = digits.length > 10 ? digits.slice(-10) : digits;
  if (local.length !== 10) {
    throw new Error("2Factor.in supports valid Indian mobile numbers only.");
  }
  return local;
}

export async function sendTwofactorOtp(mobileInput: string): Promise<{ mobile: string; sessionId: string }> {
  const settings = await getAuthSettings();
  if (!settings.enableMobileOtpLogin) {
    throw new Error("Mobile OTP login is disabled.");
  }
  if (!settings.twofactorApiKey) {
    throw new Error("2Factor.in configuration is incomplete.");
  }

  const mobile = toIndianTenDigit(mobileInput);
  const endpoint = settings.twofactorTemplateName
    ? `https://2factor.in/API/V1/${encodeURIComponent(settings.twofactorApiKey)}/SMS/${mobile}/AUTOGEN/${encodeURIComponent(settings.twofactorTemplateName)}`
    : `https://2factor.in/API/V1/${encodeURIComponent(settings.twofactorApiKey)}/SMS/${mobile}/AUTOGEN`;

  const response = await fetch(endpoint, {
    method: "GET",
    headers: { Accept: "application/json" },
    cache: "no-store",
  });
  const text = await response.text();
  let payload: TwoFactorSendResponse = {};
  try {
    payload = JSON.parse(text) as TwoFactorSendResponse;
  } catch {
    // raw error fallback
  }

  const ok = response.ok && String(payload.Status || "").toUpperCase() === "SUCCESS" && payload.Details;
  if (!ok) {
    const details = String(payload.Details || text || response.statusText || "Unknown 2Factor.in error.");
    throw new Error(`2Factor OTP send failed: ${details}`);
  }

  return { mobile, sessionId: String(payload.Details) };
}

export async function verifyTwofactorOtp(sessionId: string, code: string): Promise<boolean> {
  const settings = await getAuthSettings();
  if (!settings.enableMobileOtpLogin) {
    throw new Error("Mobile OTP login is disabled.");
  }
  if (!settings.twofactorApiKey) {
    throw new Error("2Factor.in configuration is incomplete.");
  }
  const cleanSession = String(sessionId || "").trim();
  const cleanCode = String(code || "").trim();
  if (!cleanSession || !cleanCode) return false;

  const endpoint = `https://2factor.in/API/V1/${encodeURIComponent(settings.twofactorApiKey)}/SMS/VERIFY/${encodeURIComponent(cleanSession)}/${encodeURIComponent(cleanCode)}`;
  const response = await fetch(endpoint, {
    method: "GET",
    headers: { Accept: "application/json" },
    cache: "no-store",
  });
  const text = await response.text();
  let payload: TwoFactorVerifyResponse = {};
  try {
    payload = JSON.parse(text) as TwoFactorVerifyResponse;
  } catch {
    // raw error fallback
  }
  return response.ok && String(payload.Status || "").toUpperCase() === "SUCCESS";
}


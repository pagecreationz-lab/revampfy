import "server-only";
import { getAuthSettings } from "@/lib/authSettings";

function toBasicAuth(username: string, password: string) {
  return Buffer.from(`${username}:${password}`).toString("base64");
}

export function normalizeMobileToE164(input: string): string | null {
  const plusInput = input.trim();
  if (!plusInput) return null;

  if (plusInput.startsWith("+")) {
    const digits = plusInput.replace(/[^\d+]/g, "");
    return /^\+\d{8,15}$/.test(digits) ? digits : null;
  }

  const digits = plusInput.replace(/\D/g, "");
  if (digits.length === 10) {
    return `+91${digits}`;
  }
  if (digits.length >= 11 && digits.length <= 15) {
    return `+${digits}`;
  }
  return null;
}

export async function sendTwilioOtp(mobileE164: string): Promise<void> {
  const settings = await getAuthSettings();
  if (!settings.enableMobileOtpLogin) {
    throw new Error("Mobile OTP login is disabled.");
  }
  if (!settings.twilioAccountSid || !settings.twilioAuthToken || !settings.twilioVerifyServiceSid) {
    throw new Error("Twilio Verify configuration is incomplete.");
  }

  const endpoint = `https://verify.twilio.com/v2/Services/${encodeURIComponent(
    settings.twilioVerifyServiceSid
  )}/Verifications`;
  const body = new URLSearchParams({ To: mobileE164, Channel: "sms" });
  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Basic ${toBasicAuth(settings.twilioAccountSid, settings.twilioAuthToken)}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
    cache: "no-store",
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Twilio OTP send failed: ${errorText || res.statusText}`);
  }
}

export async function verifyTwilioOtp(mobileE164: string, code: string): Promise<boolean> {
  const settings = await getAuthSettings();
  if (!settings.enableMobileOtpLogin) {
    throw new Error("Mobile OTP login is disabled.");
  }
  if (!settings.twilioAccountSid || !settings.twilioAuthToken || !settings.twilioVerifyServiceSid) {
    throw new Error("Twilio Verify configuration is incomplete.");
  }

  const endpoint = `https://verify.twilio.com/v2/Services/${encodeURIComponent(
    settings.twilioVerifyServiceSid
  )}/VerificationCheck`;
  const body = new URLSearchParams({ To: mobileE164, Code: code.trim() });
  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Basic ${toBasicAuth(settings.twilioAccountSid, settings.twilioAuthToken)}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
    cache: "no-store",
  });
  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Twilio OTP verification failed: ${errorText || res.statusText}`);
  }

  const payload = (await res.json()) as { status?: string };
  return payload.status === "approved";
}


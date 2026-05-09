import "server-only";
import fs from "fs/promises";
import path from "path";
import crypto from "crypto";
import { getAuthSettings } from "@/lib/authSettings";
import { normalizeMobileToE164 } from "@/lib/twilioVerify";

type Fast2SmsOtpRecord = {
  codeHash: string;
  expiresAt: number;
  attempts: number;
};

type Fast2SmsOtpStore = Record<string, Fast2SmsOtpRecord>;

const storePath = path.join(process.cwd(), "data", "fast2sms-otp-codes.json");

function hashCode(code: string): string {
  return crypto.createHash("sha256").update(code).digest("hex");
}

async function readStore(): Promise<Fast2SmsOtpStore> {
  try {
    const raw = await fs.readFile(storePath, "utf8");
    return JSON.parse(raw) as Fast2SmsOtpStore;
  } catch {
    return {};
  }
}

async function writeStore(store: Fast2SmsOtpStore): Promise<void> {
  await fs.mkdir(path.dirname(storePath), { recursive: true });
  await fs.writeFile(storePath, JSON.stringify(store, null, 2), "utf8");
}

function generateOtpCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export async function sendFast2SmsOtp(mobileInput: string): Promise<string> {
  const settings = await getAuthSettings();
  if (!settings.enableMobileOtpLogin) {
    throw new Error("Mobile OTP login is disabled.");
  }
  if (!settings.fast2smsApiKey) {
    throw new Error("Fast2SMS configuration is incomplete.");
  }
  const normalizedMobile = normalizeMobileToE164(mobileInput);
  if (!normalizedMobile) {
    throw new Error("Enter a valid mobile number.");
  }

  const mobileDigits = normalizedMobile.replace(/\D/g, "");
  const indianMobile = mobileDigits.length > 10 ? mobileDigits.slice(-10) : mobileDigits;
  if (indianMobile.length !== 10) {
    throw new Error("Fast2SMS supports valid Indian mobile numbers only.");
  }

  const code = generateOtpCode();
  const query = new URLSearchParams({
    authorization: settings.fast2smsApiKey,
    route: "otp",
    variables_values: code,
    numbers: indianMobile,
    flash: "0",
  });
  if (settings.fast2smsSenderId) {
    query.set("sender_id", settings.fast2smsSenderId);
  }

  const endpoints = ["https://www.fast2sms.com/dev/bulkV2"];
  let sent = false;
  let lastError = "Unknown Fast2SMS error.";

  for (const endpoint of endpoints) {
    const url = `${endpoint}?${query.toString()}`;
    const response = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
      cache: "no-store",
    });
    const text = await response.text();
    let payload: { return?: boolean; message?: string[] | string } = {};
    try {
      payload = JSON.parse(text) as { return?: boolean; message?: string[] | string };
    } catch {
      // preserve raw text fallback below
    }
    if (response.ok && payload.return !== false) {
      sent = true;
      break;
    }
    const message = Array.isArray(payload.message)
      ? payload.message.join(", ")
      : payload.message || text || response.statusText;
    const looksLikeHtml = /<!doctype html>|<html/i.test(message);
    lastError = looksLikeHtml
      ? `Fast2SMS endpoint returned HTML error page (HTTP ${response.status}). Check API key account access and endpoint availability.`
      : message;
  }
  if (!sent) throw new Error(`Fast2SMS OTP send failed: ${lastError}`);

  const store = await readStore();
  store[normalizedMobile] = {
    codeHash: hashCode(code),
    expiresAt: Date.now() + 10 * 60 * 1000,
    attempts: 0,
  };
  await writeStore(store);
  return normalizedMobile;
}

export async function verifyFast2SmsOtp(
  mobileInput: string,
  codeInput: string
): Promise<boolean> {
  const normalizedMobile = normalizeMobileToE164(mobileInput);
  if (!normalizedMobile) return false;
  const store = await readStore();
  const record = store[normalizedMobile];
  if (!record) return false;
  if (record.expiresAt < Date.now()) {
    delete store[normalizedMobile];
    await writeStore(store);
    return false;
  }

  const ok = hashCode(codeInput.trim()) === record.codeHash;
  if (ok) {
    delete store[normalizedMobile];
    await writeStore(store);
    return true;
  }

  record.attempts += 1;
  if (record.attempts >= 5) {
    delete store[normalizedMobile];
  } else {
    store[normalizedMobile] = record;
  }
  await writeStore(store);
  return false;
}

import "server-only";
import fs from "fs/promises";
import path from "path";

export type EnquirySettings = {
  mailTo: string;
  smtpHost: string;
  smtpPort: number;
  smtpUser: string;
  smtpPass: string;
  smtpFrom: string;
};

const settingsPath = path.join(process.cwd(), "data", "enquiry-settings.json");

function fromEnv(): EnquirySettings {
  const smtpUser = process.env.SMTP_USER || "";
  return {
    mailTo: process.env.ENQUIRY_MAIL_TO || "support@revampfy.in",
    smtpHost: process.env.SMTP_HOST || "",
    smtpPort: Number(process.env.SMTP_PORT || "587"),
    smtpUser,
    smtpPass: process.env.SMTP_PASS || "",
    smtpFrom: process.env.SMTP_FROM || smtpUser,
  };
}

export async function getEnquirySettings(): Promise<EnquirySettings> {
  const defaults = fromEnv();
  try {
    const raw = await fs.readFile(settingsPath, "utf8");
    const parsed = JSON.parse(raw) as Partial<EnquirySettings>;
    return {
      mailTo: parsed.mailTo || defaults.mailTo,
      smtpHost: parsed.smtpHost || defaults.smtpHost,
      smtpPort: Number(parsed.smtpPort || defaults.smtpPort || 587),
      smtpUser: parsed.smtpUser || defaults.smtpUser,
      smtpPass: parsed.smtpPass || defaults.smtpPass,
      smtpFrom: parsed.smtpFrom || parsed.smtpUser || defaults.smtpFrom,
    };
  } catch {
    return defaults;
  }
}

export async function saveEnquirySettings(
  next: Partial<EnquirySettings>
): Promise<EnquirySettings> {
  const current = await getEnquirySettings();
  const merged: EnquirySettings = {
    ...current,
    ...next,
    smtpPort: Number(next.smtpPort || current.smtpPort || 587),
    smtpPass: next.smtpPass !== undefined ? next.smtpPass : current.smtpPass,
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

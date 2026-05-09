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
  enableAutoReplyContact: boolean;
  enableAutoReplyBulk: boolean;
  autoReplyContactSubject: string;
  autoReplyContactBody: string;
  autoReplyBulkSubject: string;
  autoReplyBulkBody: string;
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
    enableAutoReplyContact: true,
    enableAutoReplyBulk: true,
    autoReplyContactSubject: "We received your contact enquiry - Revampfy",
    autoReplyContactBody:
      "Hi {name},\n\nThanks for contacting Revampfy. We received your enquiry and our team will get back to you shortly.\n\nRegards,\nRevampfy Support",
    autoReplyBulkSubject: "We received your bulk order enquiry - Revampfy",
    autoReplyBulkBody:
      "Hi {name},\n\nThanks for your bulk enquiry at Revampfy. We received your request and our team will contact you with pricing and availability soon.\n\nRegards,\nRevampfy Bulk Team",
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
      enableAutoReplyContact:
        typeof parsed.enableAutoReplyContact === "boolean"
          ? parsed.enableAutoReplyContact
          : defaults.enableAutoReplyContact,
      enableAutoReplyBulk:
        typeof parsed.enableAutoReplyBulk === "boolean"
          ? parsed.enableAutoReplyBulk
          : defaults.enableAutoReplyBulk,
      autoReplyContactSubject:
        parsed.autoReplyContactSubject || defaults.autoReplyContactSubject,
      autoReplyContactBody:
        parsed.autoReplyContactBody || defaults.autoReplyContactBody,
      autoReplyBulkSubject: parsed.autoReplyBulkSubject || defaults.autoReplyBulkSubject,
      autoReplyBulkBody: parsed.autoReplyBulkBody || defaults.autoReplyBulkBody,
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
    enableAutoReplyContact:
      typeof next.enableAutoReplyContact === "boolean"
        ? next.enableAutoReplyContact
        : current.enableAutoReplyContact,
    enableAutoReplyBulk:
      typeof next.enableAutoReplyBulk === "boolean"
        ? next.enableAutoReplyBulk
        : current.enableAutoReplyBulk,
    autoReplyContactSubject:
      typeof next.autoReplyContactSubject === "string"
        ? next.autoReplyContactSubject
        : current.autoReplyContactSubject,
    autoReplyContactBody:
      typeof next.autoReplyContactBody === "string"
        ? next.autoReplyContactBody
        : current.autoReplyContactBody,
    autoReplyBulkSubject:
      typeof next.autoReplyBulkSubject === "string"
        ? next.autoReplyBulkSubject
        : current.autoReplyBulkSubject,
    autoReplyBulkBody:
      typeof next.autoReplyBulkBody === "string"
        ? next.autoReplyBulkBody
        : current.autoReplyBulkBody,
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

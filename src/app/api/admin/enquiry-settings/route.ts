import { maskSecret, getEnquirySettings, saveEnquirySettings } from "@/lib/enquirySettings";

export const dynamic = "force-dynamic";

export async function GET() {
  const settings = await getEnquirySettings();
  return Response.json({
    settings: {
      ...settings,
      smtpPass: "",
      maskedSmtpPass: maskSecret(settings.smtpPass),
    },
  });
}

export async function POST(request: Request) {
  const payload = (await request.json()) as {
    mailTo?: string;
    smtpHost?: string;
    smtpPort?: number;
    smtpUser?: string;
    smtpPass?: string;
    smtpFrom?: string;
    enableAutoReplyContact?: boolean;
    enableAutoReplyBulk?: boolean;
    autoReplyContactSubject?: string;
    autoReplyContactBody?: string;
    autoReplyBulkSubject?: string;
    autoReplyBulkBody?: string;
  };

  const saved = await saveEnquirySettings({
    mailTo: (payload.mailTo || "").trim(),
    smtpHost: (payload.smtpHost || "").trim(),
    smtpPort: Number(payload.smtpPort || 587),
    smtpUser: (payload.smtpUser || "").trim(),
    smtpPass:
      payload.smtpPass !== undefined && payload.smtpPass !== ""
        ? payload.smtpPass
        : undefined,
    smtpFrom: (payload.smtpFrom || "").trim(),
    enableAutoReplyContact:
      typeof payload.enableAutoReplyContact === "boolean"
        ? payload.enableAutoReplyContact
        : undefined,
    enableAutoReplyBulk:
      typeof payload.enableAutoReplyBulk === "boolean" ? payload.enableAutoReplyBulk : undefined,
    autoReplyContactSubject:
      typeof payload.autoReplyContactSubject === "string"
        ? payload.autoReplyContactSubject.trim()
        : undefined,
    autoReplyContactBody:
      typeof payload.autoReplyContactBody === "string"
        ? payload.autoReplyContactBody
        : undefined,
    autoReplyBulkSubject:
      typeof payload.autoReplyBulkSubject === "string"
        ? payload.autoReplyBulkSubject.trim()
        : undefined,
    autoReplyBulkBody:
      typeof payload.autoReplyBulkBody === "string" ? payload.autoReplyBulkBody : undefined,
  });

  return Response.json({
    settings: {
      ...saved,
      smtpPass: "",
      maskedSmtpPass: maskSecret(saved.smtpPass),
    },
  });
}

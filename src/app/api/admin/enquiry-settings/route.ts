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
  });

  return Response.json({
    settings: {
      ...saved,
      smtpPass: "",
      maskedSmtpPass: maskSecret(saved.smtpPass),
    },
  });
}

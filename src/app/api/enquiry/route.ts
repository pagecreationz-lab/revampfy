import nodemailer from "nodemailer";
import { getEnquirySettings } from "@/lib/enquirySettings";

type EnquiryPayload = {
  mode: "contact" | "bulk";
  businessName: string;
  contactPerson: string;
  email: string;
  mobile: string;
  details: string;
};

type SmtpLikeError = Error & {
  responseCode?: number;
  response?: string;
  code?: string;
};

function must(value: string | undefined, key: string) {
  if (!value) {
    throw new Error(`Missing ${key} configuration`);
  }
  return value;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function applyReplyTemplate(
  template: string,
  context: { name: string; businessName: string; mode: "contact" | "bulk"; mobile: string }
) {
  return template
    .replace(/\{name\}/gi, context.name)
    .replace(/\{businessName\}/gi, context.businessName)
    .replace(/\{mode\}/gi, context.mode === "bulk" ? "Bulk Enquiry" : "Contact Us")
    .replace(/\{mobile\}/gi, context.mobile);
}

function normalizeSmtpPass(host: string, pass: string) {
  const h = host.toLowerCase();
  // Gmail app passwords are often copied with spaces (xxxx xxxx xxxx xxxx).
  if (h.includes("gmail.com")) {
    return pass.replace(/\s+/g, "");
  }
  return pass;
}

function mapEnquiryMailError(error: unknown) {
  const err = error as SmtpLikeError;
  const raw = `${err?.message || ""} ${err?.response || ""}`.toLowerCase();
  if (
    err?.responseCode === 535 ||
    raw.includes("badcredentials") ||
    raw.includes("username and password not accepted")
  ) {
    return "SMTP login failed. For Gmail, use a Google App Password (16 characters) and set SMTP Host smtp.gmail.com, Port 587, and SMTP User as your Gmail address.";
  }
  if (err?.responseCode === 534 || raw.includes("application-specific password")) {
    return "SMTP requires an application-specific password. Generate a Google App Password and update SMTP password in CMS.";
  }
  return err instanceof Error ? err.message : "Unable to send enquiry email.";
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as Partial<EnquiryPayload>;
    const mode = payload.mode === "bulk" ? "bulk" : "contact";
    const businessName = (payload.businessName || "").trim();
    const contactPerson = (payload.contactPerson || "").trim();
    const email = (payload.email || "").trim();
    const mobile = (payload.mobile || "").trim();
    const details = (payload.details || "").trim();

    if (!businessName || !contactPerson || !email || !mobile || !details) {
      return Response.json({ error: "All fields are required." }, { status: 400 });
    }

    const settings = await getEnquirySettings();
    const smtpHost = must(settings.smtpHost, "SMTP_HOST");
    const smtpPort = Number(settings.smtpPort || 587);
    const smtpUser = must(settings.smtpUser, "SMTP_USER");
    const smtpPass = normalizeSmtpPass(smtpHost, must(settings.smtpPass, "SMTP_PASS"));
    const smtpFrom = settings.smtpFrom || smtpUser;
    const mailTo = settings.mailTo || "support@revampfy.in";

    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465,
      auth: { user: smtpUser, pass: smtpPass },
    });

    const subject =
      mode === "bulk"
        ? `New Bulk Orders Enquiry - ${businessName}`
        : `New Contact Us Enquiry - ${businessName}`;

    const html = `
      <h2>${mode === "bulk" ? "Bulk Orders Enquiry" : "Contact Us Enquiry"}</h2>
      <p><strong>Business/Organization:</strong> ${escapeHtml(businessName)}</p>
      <p><strong>Contact Person:</strong> ${escapeHtml(contactPerson)}</p>
      <p><strong>Email:</strong> ${escapeHtml(email)}</p>
      <p><strong>Mobile:</strong> ${escapeHtml(mobile)}</p>
      <p><strong>Details:</strong><br/>${escapeHtml(details).replace(/\n/g, "<br/>")}</p>
    `;

    await transporter.sendMail({
      from: smtpFrom,
      to: mailTo,
      replyTo: email,
      subject,
      text: `${subject}
Business/Organization: ${businessName}
Contact Person: ${contactPerson}
Email: ${email}
Mobile: ${mobile}
Details: ${details}`,
      html,
    });

    const shouldAutoReply =
      mode === "bulk" ? settings.enableAutoReplyBulk : settings.enableAutoReplyContact;
    if (shouldAutoReply) {
      const rawSubject =
        mode === "bulk" ? settings.autoReplyBulkSubject : settings.autoReplyContactSubject;
      const rawBody = mode === "bulk" ? settings.autoReplyBulkBody : settings.autoReplyContactBody;
      const replySubject = applyReplyTemplate(rawSubject || "We received your enquiry", {
        name: contactPerson,
        businessName,
        mode,
        mobile,
      });
      const replyBody = applyReplyTemplate(rawBody || "Thanks, we received your enquiry.", {
        name: contactPerson,
        businessName,
        mode,
        mobile,
      });
      await transporter.sendMail({
        from: smtpFrom,
        to: email,
        subject: replySubject,
        text: replyBody,
        html: `<div style="font-family:Arial,sans-serif;line-height:1.6;white-space:pre-wrap">${escapeHtml(
          replyBody
        )}</div>`,
      });
    }

    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ error: mapEnquiryMailError(error) }, { status: 500 });
  }
}

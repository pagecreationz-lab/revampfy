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
    const smtpPass = must(settings.smtpPass, "SMTP_PASS");
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

    return Response.json({ ok: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to send enquiry email.";
    return Response.json({ error: message }, { status: 500 });
  }
}

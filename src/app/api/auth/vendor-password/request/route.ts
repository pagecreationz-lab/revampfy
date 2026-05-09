import nodemailer from "nodemailer";
import { getEnquirySettings } from "@/lib/enquirySettings";
import { generateEmailLoginCode, saveEmailLoginCode } from "@/lib/emailLoginCodes";
import { getVendorByEmail } from "@/lib/vendorPortal";

const CODE_TTL_MS = 10 * 60 * 1000;

function must(value: string | undefined, key: string) {
  if (!value) throw new Error(`Missing ${key} configuration`);
  return value;
}

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    const email = String(payload?.email || "").trim().toLowerCase();
    if (!email) {
      return Response.json({ error: "Vendor email is required." }, { status: 400 });
    }

    const vendor = await getVendorByEmail(email);
    if (!vendor || !vendor.isActive) {
      return Response.json({ error: "Vendor account not found." }, { status: 404 });
    }

    const code = generateEmailLoginCode();
    await saveEmailLoginCode(`vendor-reset:${email}`, code, CODE_TTL_MS);

    const settings = await getEnquirySettings();
    const smtpHost = must(settings.smtpHost, "SMTP_HOST");
    const smtpPort = Number(settings.smtpPort || 587);
    const smtpUser = must(settings.smtpUser, "SMTP_USER");
    const smtpPass = must(settings.smtpPass, "SMTP_PASS");
    const smtpFrom = settings.smtpFrom || smtpUser;

    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465,
      auth: { user: smtpUser, pass: smtpPass },
    });

    await transporter.sendMail({
      from: smtpFrom,
      to: email,
      subject: "Vendor password reset verification code",
      text: `Your vendor password reset code is ${code}. It is valid for 10 minutes.`,
      html: `<p>Your Vendor Password Reset verification code is:</p><h2 style="letter-spacing:2px;">${code}</h2><p>This code is valid for 10 minutes.</p>`,
    });

    return Response.json({ ok: true, message: "Verification code sent to vendor email." });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to send reset code.";
    return Response.json({ error: message }, { status: 500 });
  }
}


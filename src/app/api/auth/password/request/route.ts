import nodemailer from "nodemailer";
import { getAuthSettings } from "@/lib/authSettings";
import { getEnquirySettings } from "@/lib/enquirySettings";
import { getCustomerByEmail } from "@/lib/customerData";
import { generatePasswordResetCode, savePasswordResetCode } from "@/lib/passwordResetCodes";

const CODE_TTL_MS = 10 * 60 * 1000;

function must(value: string | undefined, key: string) {
  if (!value) throw new Error(`Missing ${key} configuration`);
  return value;
}

function normalizeSmtpPass(host: string, pass: string) {
  return host.toLowerCase().includes("gmail.com") ? pass.replace(/\s+/g, "") : pass;
}

function maskEmail(email: string) {
  const [name, domain] = email.split("@");
  if (!name || !domain) return email;
  const maskedName =
    name.length <= 2 ? `${name[0] || "*"}*` : `${name.slice(0, 2)}${"*".repeat(name.length - 2)}`;
  return `${maskedName}@${domain}`;
}

export async function POST(request: Request) {
  try {
    const authSettings = await getAuthSettings();
    if (!authSettings.enableEmailPasswordLogin && !authSettings.enableEmailCodeLogin) {
      return Response.json({ error: "Email login is disabled by admin." }, { status: 403 });
    }

    const payload = await request.json();
    const email = String(payload?.email || "").trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return Response.json({ error: "Enter a valid email address." }, { status: 400 });
    }

    const user = await getCustomerByEmail(email);
    if (!user) {
      return Response.json({ error: "No account found with this email." }, { status: 404 });
    }

    const code = generatePasswordResetCode();
    await savePasswordResetCode(email, code, CODE_TTL_MS);

    const settings = await getEnquirySettings();
    const smtpHost = must(settings.smtpHost, "SMTP_HOST");
    const smtpPort = Number(settings.smtpPort || 587);
    const smtpUser = must(settings.smtpUser, "SMTP_USER");
    const smtpPass = normalizeSmtpPass(smtpHost, must(settings.smtpPass, "SMTP_PASS"));
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
      subject: "Your Revampfy password reset code",
      text: `Your password reset code is ${code}. It is valid for 10 minutes.`,
      html: `<p>Your Revampfy password reset code is:</p><h2 style="letter-spacing:2px;">${code}</h2><p>This code is valid for 10 minutes.</p>`,
    });

    return Response.json({
      ok: true,
      message: `Reset code sent to ${maskEmail(email)}.`,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to send reset code.";
    return Response.json({ error: message }, { status: 500 });
  }
}


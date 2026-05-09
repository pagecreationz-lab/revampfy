import nodemailer from "nodemailer";
import { NextResponse } from "next/server";
import { getAuthSettings } from "@/lib/authSettings";
import { getEnquirySettings } from "@/lib/enquirySettings";
import { generateEmailLoginCode, saveEmailLoginCode } from "@/lib/emailLoginCodes";
import { getVendorByEmail } from "@/lib/vendorPortal";

const CODE_TTL_MS = 10 * 60 * 1000;

function must(value: string | undefined, key: string) {
  if (!value) throw new Error(`Missing ${key} configuration`);
  return value;
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
    if (!authSettings.vendorEnableEmailCodeLogin) {
      return Response.json({ error: "Email code login is disabled." }, { status: 403 });
    }

    const payload = await request.json();
    const email = String(payload?.email || "").trim().toLowerCase();
    const password = String(payload?.password || "").trim();

    if (!email || !password) {
      return Response.json({ error: "Email and password are required." }, { status: 400 });
    }

    const vendor = await getVendorByEmail(email);
    if (!vendor || !vendor.isActive) {
      return Response.json({ error: "Vendor account not found." }, { status: 404 });
    }

    const code = generateEmailLoginCode();
    await saveEmailLoginCode(email, code, CODE_TTL_MS);

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
      subject: "Your Vendor Portal verification code",
      text: `Your vendor login verification code is ${code}. It is valid for 10 minutes.`,
      html: `<p>Your Vendor Portal verification code is:</p><h2 style="letter-spacing:2px;">${code}</h2><p>This code is valid for 10 minutes.</p>`,
    });

    const response = NextResponse.json({
      ok: true,
      message: `Verification code sent to ${maskEmail(email)}.`,
    });
    response.cookies.set("pcgs_pending_vendor_email", email, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 600,
    });
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to send verification code.";
    return Response.json({ error: message }, { status: 500 });
  }
}

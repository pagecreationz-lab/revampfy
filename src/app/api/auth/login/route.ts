import { NextResponse } from "next/server";
import { createSessionToken, getAdminUsers, verifyPassword } from "@/lib/auth";
import { getCustomerByEmail } from "@/lib/customerData";
import { getAuthSettings } from "@/lib/authSettings";
import { getEnquirySettings } from "@/lib/enquirySettings";
import { generateEmailLoginCode, saveEmailLoginCode } from "@/lib/emailLoginCodes";
import nodemailer from "nodemailer";

const MAX_AGE = 60 * 60 * 12;
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
    const payload = await request.json();
    const email = (payload?.email as string | undefined)?.toLowerCase();
    const password = payload?.password as string | undefined;
    const authMethod =
      payload?.authMethod === "password_only" ? "password_only" : "password_with_code";

    if (!email || !password) {
      return NextResponse.json({ error: "Email and password are required." }, { status: 400 });
    }

    const users = getAdminUsers();
    const adminUser = users.find((item) => item.email.toLowerCase() === email);
    const customerUser = await getCustomerByEmail(email);
    const user = adminUser || customerUser;

    if (!user || !verifyPassword(password, user.passwordHash)) {
      return NextResponse.json({ error: "Invalid credentials." }, { status: 401 });
    }

    const role = adminUser ? "admin" : "customer";

    if (role === "customer") {
      const authSettings = await getAuthSettings();
      if (authMethod === "password_only") {
        if (!authSettings.enableEmailPasswordLogin) {
          return NextResponse.json(
            { error: "Email + password login is disabled. Contact admin." },
            { status: 403 }
          );
        }

        const exp = Date.now() + MAX_AGE * 1000;
        const token = createSessionToken({ email: user.email, role, exp });
        const response = NextResponse.json({ ok: true, exp, role });
        response.cookies.set("pcgs_admin_session", token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "lax",
          path: "/",
          maxAge: MAX_AGE,
        });
        return response;
      }

      if (!authSettings.enableEmailCodeLogin) {
        return NextResponse.json(
          { error: "Customer verification login is disabled. Contact admin." },
          { status: 403 }
        );
      }

      const code = generateEmailLoginCode();
      await saveEmailLoginCode(user.email, code, CODE_TTL_MS);

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
        to: user.email,
        subject: "Your Revampfy login verification code",
        text: `Your verification code is ${code}. It is valid for 10 minutes.`,
        html: `<p>Your Revampfy verification code is:</p><h2 style="letter-spacing:2px;">${code}</h2><p>This code is valid for 10 minutes.</p>`,
      });

      const verifyResponse = NextResponse.json({
        ok: true,
        requiresVerification: true,
        message: `Verification code sent to ${maskEmail(user.email)}.`,
      });
      verifyResponse.cookies.set("pcgs_pending_login_email", user.email, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 10,
      });
      return verifyResponse;
    }

    const exp = Date.now() + MAX_AGE * 1000;
    const token = createSessionToken({ email: user.email, role, exp });
    const response = NextResponse.json({ ok: true, exp, role });
    response.cookies.set("pcgs_admin_session", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: MAX_AGE,
    });
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Login failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

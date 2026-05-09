import { NextResponse } from "next/server";
import { createSessionToken } from "@/lib/auth";
import { ensureCustomerUserByEmail, updateCustomerProfile } from "@/lib/customerData";
import { normalizeMobileToE164, verifyTwilioOtp } from "@/lib/twilioVerify";
import { getAuthSettings } from "@/lib/authSettings";
import { verifyFast2SmsOtp } from "@/lib/fast2smsOtp";
import { verifyTwofactorOtp } from "@/lib/twofactorOtp";

const MAX_AGE = 60 * 60 * 12;
const MOBILE_EMAIL_DOMAIN = "revampfy.in";

export async function POST(request: Request) {
  try {
    const authSettings = await getAuthSettings();
    if (!authSettings.enableMobileOtpLogin) {
      return NextResponse.json({ error: "Mobile OTP login is disabled." }, { status: 403 });
    }

    const payload = await request.json();
    const otp = String(payload?.otp || "").trim();
    const cookie = request.headers.get("cookie") || "";
    const mobileMatch = cookie.match(/pcgs_otp_mobile=([^;]+)/);
    const twofactorSessionMatch = cookie.match(/pcgs_otp_2factor_session=([^;]+)/);
    let cookieValue = mobileMatch?.[1] || "";
    let twofactorSession = twofactorSessionMatch?.[1] || "";
    for (let i = 0; i < 2; i += 1) {
      try {
        const decoded = decodeURIComponent(cookieValue);
        if (decoded === cookieValue) break;
        cookieValue = decoded;
      } catch {
        break;
      }
    }
    for (let i = 0; i < 2; i += 1) {
      try {
        const decoded = decodeURIComponent(twofactorSession);
        if (decoded === twofactorSession) break;
        twofactorSession = decoded;
      } catch {
        break;
      }
    }
    const mobile = normalizeMobileToE164(cookieValue);

    if (!mobile) {
      return NextResponse.json(
        { error: "OTP session expired. Request OTP again." },
        { status: 400 }
      );
    }

    const isValid =
      authSettings.mobileOtpProvider === "fast2sms"
        ? await verifyFast2SmsOtp(mobile, otp)
        : authSettings.mobileOtpProvider === "twofactor"
          ? await verifyTwofactorOtp(twofactorSession, otp)
        : await verifyTwilioOtp(mobile, otp);
    if (!isValid) {
      return NextResponse.json({ error: "Invalid OTP." }, { status: 401 });
    }

    const exp = Date.now() + MAX_AGE * 1000;
    const sanitized = mobile.replace(/\D/g, "");
    const email = `mobile${sanitized}@${MOBILE_EMAIL_DOMAIN}`;
    await ensureCustomerUserByEmail(email, `Mobile User ${sanitized.slice(-4)}`);
    await updateCustomerProfile(email, {
      mobile,
      needsProfileCompletion: true,
    });
    const token = createSessionToken({ email, role: "customer", exp });

    const response = NextResponse.json({ ok: true, exp });
    response.cookies.set("pcgs_admin_session", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: MAX_AGE,
    });
    response.cookies.set("pcgs_otp_mobile", "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    });
    response.cookies.set("pcgs_otp_2factor_session", "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    });
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "OTP verification failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

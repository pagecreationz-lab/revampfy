import { NextResponse } from "next/server";
import { getAuthSettings } from "@/lib/authSettings";
import { normalizeMobileToE164, sendTwilioOtp } from "@/lib/twilioVerify";

export async function POST(request: Request) {
  try {
    const authSettings = await getAuthSettings();
    if (!authSettings.enableMobileOtpLogin) {
      return NextResponse.json({ error: "Mobile OTP login is disabled." }, { status: 403 });
    }

    const payload = await request.json();
    const mobileRaw = String(payload?.mobile || "");
    const mobileE164 = normalizeMobileToE164(mobileRaw);
    if (!mobileE164) {
      return NextResponse.json({ error: "Enter a valid mobile number." }, { status: 400 });
    }
    await sendTwilioOtp(mobileE164);

    const response = NextResponse.json({
      ok: true,
      message: "OTP sent successfully.",
    });
    response.cookies.set("pcgs_otp_mobile", mobileE164, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 10,
    });
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "OTP request failed";
    if (message.includes('"code":20003') || message.includes("code:20003")) {
      return NextResponse.json(
        {
          error:
            "Twilio authentication failed at runtime (20003). Use LIVE Account SID + Auth Token from the SAME Twilio account/subaccount as this Verify Service SID, then test again in CMS.",
        },
        { status: 401 }
      );
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

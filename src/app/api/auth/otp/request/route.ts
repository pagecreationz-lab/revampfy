import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    const mobile = String(payload?.mobile || "").replace(/\D/g, "");
    if (mobile.length < 10) {
      return NextResponse.json({ error: "Enter a valid mobile number." }, { status: 400 });
    }

    const response = NextResponse.json({
      ok: true,
      message: "OTP sent successfully.",
      demoOtp: process.env.NODE_ENV === "production" ? undefined : "123456",
    });
    response.cookies.set("pcgs_otp_mobile", mobile, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 10,
    });
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "OTP request failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}


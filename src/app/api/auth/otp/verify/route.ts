import { NextResponse } from "next/server";
import { createSessionToken } from "@/lib/auth";

const MAX_AGE = 60 * 60 * 12;

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    const otp = String(payload?.otp || "").trim();
    const cookie = request.headers.get("cookie") || "";
    const mobileMatch = cookie.match(/pcgs_otp_mobile=([^;]+)/);
    const mobile = mobileMatch?.[1];

    if (!mobile) {
      return NextResponse.json(
        { error: "OTP session expired. Request OTP again." },
        { status: 400 }
      );
    }

    if (otp !== "123456") {
      return NextResponse.json({ error: "Invalid OTP." }, { status: 401 });
    }

    const exp = Date.now() + MAX_AGE * 1000;
    const email = `mobile${mobile}@pcgs.local`;
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
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "OTP verification failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}


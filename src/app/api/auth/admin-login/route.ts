import { NextResponse } from "next/server";
import { createSessionToken, getAdminUsers, verifyPassword } from "@/lib/auth";

const MAX_AGE = 60 * 60 * 12;

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    const email = (payload?.email as string | undefined)?.toLowerCase().trim();
    const password = (payload?.password as string | undefined)?.trim();

    if (!email || !password) {
      return NextResponse.json({ error: "Email and password are required." }, { status: 400 });
    }

    const adminUser = getAdminUsers().find((item) => item.email.toLowerCase() === email);
    if (!adminUser || !verifyPassword(password, adminUser.passwordHash)) {
      return NextResponse.json({ error: "Invalid admin credentials." }, { status: 401 });
    }

    const exp = Date.now() + MAX_AGE * 1000;
    const token = createSessionToken({ email: adminUser.email, role: "admin", exp });
    const response = NextResponse.json({ ok: true, exp, role: "admin" });
    response.cookies.set("pcgs_admin_session", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: MAX_AGE,
    });
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Admin login failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}


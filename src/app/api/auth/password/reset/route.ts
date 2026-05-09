import { getAuthSettings } from "@/lib/authSettings";
import { getCustomerByEmail, updateCustomerPasswordByEmail } from "@/lib/customerData";
import { verifyPasswordResetCode } from "@/lib/passwordResetCodes";

export async function POST(request: Request) {
  try {
    const authSettings = await getAuthSettings();
    if (!authSettings.enableEmailPasswordLogin && !authSettings.enableEmailCodeLogin) {
      return Response.json({ error: "Email login is disabled by admin." }, { status: 403 });
    }

    const payload = await request.json();
    const email = String(payload?.email || "").trim().toLowerCase();
    const code = String(payload?.code || "").trim();
    const newPassword = String(payload?.newPassword || "");

    if (!email || !code || !newPassword) {
      return Response.json(
        { error: "Email, reset code, and new password are required." },
        { status: 400 }
      );
    }
    if (newPassword.length < 6) {
      return Response.json({ error: "Password must be at least 6 characters." }, { status: 400 });
    }

    const user = await getCustomerByEmail(email);
    if (!user) {
      return Response.json({ error: "No account found with this email." }, { status: 404 });
    }

    const result = await verifyPasswordResetCode(email, code);
    if (!result.ok) {
      return Response.json({ error: result.error || "Invalid reset code." }, { status: 401 });
    }

    await updateCustomerPasswordByEmail(email, newPassword);
    return Response.json({ ok: true, message: "Password reset successful. Please login." });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to reset password.";
    return Response.json({ error: message }, { status: 500 });
  }
}


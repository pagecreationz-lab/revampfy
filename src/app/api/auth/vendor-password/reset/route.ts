import { verifyEmailLoginCode } from "@/lib/emailLoginCodes";
import { getVendorByEmail, setVendorPasswordByEmail } from "@/lib/vendorPortal";

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    const email = String(payload?.email || "").trim().toLowerCase();
    const code = String(payload?.code || "").trim();
    const newPassword = String(payload?.newPassword || "").trim();

    if (!email || !code || !newPassword) {
      return Response.json({ error: "Email, code, and new password are required." }, { status: 400 });
    }

    const vendor = await getVendorByEmail(email);
    if (!vendor || !vendor.isActive) {
      return Response.json({ error: "Vendor account not found." }, { status: 404 });
    }

    const verify = await verifyEmailLoginCode(`vendor-reset:${email}`, code);
    if (!verify.ok) {
      return Response.json({ error: verify.error || "Invalid verification code." }, { status: 401 });
    }

    await setVendorPasswordByEmail(email, newPassword);
    return Response.json({ ok: true, message: "Vendor password reset successful." });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to reset password.";
    return Response.json({ error: message }, { status: 500 });
  }
}


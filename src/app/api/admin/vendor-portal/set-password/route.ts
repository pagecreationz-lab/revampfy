import { NextResponse } from "next/server";
import { requireSession } from "@/lib/sessionGuard";
import { setVendorPassword } from "@/lib/vendorPortal";

export async function POST(request: Request) {
  const auth = requireSession(request, "admin");
  if (auth.error) return auth.error;

  try {
    const payload = await request.json();
    const vendorId = String(payload?.vendorId || "").trim();
    const password = String(payload?.password || "").trim();

    if (!vendorId || !password) {
      return NextResponse.json({ error: "vendorId and password are required." }, { status: 400 });
    }

    const data = await setVendorPassword(vendorId, password);
    return NextResponse.json({ ok: true, data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to set vendor password.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

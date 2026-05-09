import { NextResponse } from "next/server";
import { requireSession } from "@/lib/sessionGuard";
import { getVendorSheetLink } from "@/lib/vendorSheetLinks";
import { auditGoogleSheetPermissions } from "@/lib/adminIntegrations";

export async function POST(request: Request) {
  const auth = requireSession(request, "admin");
  if (auth.error) return auth.error;

  try {
    const payload = (await request.json()) as {
      vendorId?: string;
      spreadsheetId?: string;
      email?: string;
    };
    const vendorId = String(payload?.vendorId || "").trim();
    const inputSheetId = String(payload?.spreadsheetId || "").trim();
    const email = String(payload?.email || "").trim().toLowerCase();

    let spreadsheetId = inputSheetId;
    if (!spreadsheetId && vendorId) {
      const link = await getVendorSheetLink(vendorId, true);
      spreadsheetId = String(link?.sheetId || "").trim();
    }
    if (!spreadsheetId) {
      return NextResponse.json({ error: "spreadsheetId or vendorId is required." }, { status: 400 });
    }

    const result = await auditGoogleSheetPermissions({ spreadsheetId, email });
    return NextResponse.json({ ok: true, audit: result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to audit permissions.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}


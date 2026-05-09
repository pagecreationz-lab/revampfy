import { NextResponse } from "next/server";
import { requireSession } from "@/lib/sessionGuard";
import { getVendorByEmail } from "@/lib/vendorPortal";
import { getVendorSheetLink } from "@/lib/vendorSheetLinks";
import { createVendorSheetAccessRequest, listVendorSheetAccessRequests } from "@/lib/vendorSheetAccessRequests";

export async function GET(request: Request) {
  const auth = requireSession(request, "vendor");
  if (auth.error) return auth.error;
  const vendor = await getVendorByEmail(auth.session!.email);
  if (!vendor) return NextResponse.json({ error: "Vendor not found." }, { status: 404 });

  const requests = await listVendorSheetAccessRequests();
  const vendorRequests = requests.filter((entry) => entry.vendorId === vendor.id);
  return NextResponse.json({ ok: true, requests: vendorRequests });
}

export async function POST(request: Request) {
  const auth = requireSession(request, "vendor");
  if (auth.error) return auth.error;
  const vendor = await getVendorByEmail(auth.session!.email);
  if (!vendor) return NextResponse.json({ error: "Vendor not found." }, { status: 404 });

  try {
    const payload = (await request.json()) as { requestedGoogleEmail?: string };
    const requestedGoogleEmail = String(payload?.requestedGoogleEmail || "").trim().toLowerCase();
    if (!requestedGoogleEmail || !requestedGoogleEmail.includes("@")) {
      return NextResponse.json({ error: "Valid Google email is required." }, { status: 400 });
    }
    const link = await getVendorSheetLink(vendor.id, true);
    if (!link?.sheetId) {
      return NextResponse.json({ error: "No Google Sheet assigned to this vendor account." }, { status: 400 });
    }
    const created = await createVendorSheetAccessRequest({
      vendorId: vendor.id,
      vendorEmail: vendor.email,
      requestedGoogleEmail,
      sheetId: link.sheetId,
      sheetName: link.sheetName,
      sheetUrl: link.sheetUrl,
    });
    return NextResponse.json({ ok: true, request: created });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to create access request.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

import { NextResponse } from "next/server";
import { deleteVendor, getVendorPortalData, saveVendorPortalData } from "@/lib/vendorPortal";
import { requireSession } from "@/lib/sessionGuard";

export async function GET(request: Request) {
  const auth = requireSession(request, "admin");
  if (auth.error) return auth.error;

  const data = await getVendorPortalData();
  return NextResponse.json({ ok: true, data });
}

export async function POST(request: Request) {
  const auth = requireSession(request, "admin");
  if (auth.error) return auth.error;

  try {
    const payload = await request.json();
    const data = await saveVendorPortalData(payload);
    return NextResponse.json({ ok: true, data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to save vendor portal data.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  const auth = requireSession(request, "admin");
  if (auth.error) return auth.error;

  const { searchParams } = new URL(request.url);
  const vendorId = String(searchParams.get("vendorId") || "").trim();
  if (!vendorId) {
    return NextResponse.json({ error: "vendorId is required." }, { status: 400 });
  }

  try {
    const data = await deleteVendor(vendorId);
    return NextResponse.json({ ok: true, data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to delete vendor.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

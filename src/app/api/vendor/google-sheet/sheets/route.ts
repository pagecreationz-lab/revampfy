import { NextResponse } from "next/server";
import { requireSession } from "@/lib/sessionGuard";
import { getVendorByEmail } from "@/lib/vendorPortal";
import { getVendorGoogleAccessToken, getVendorSheetLink } from "@/lib/vendorSheetLinks";

export async function GET(request: Request) {
  const auth = requireSession(request, "vendor");
  if (auth.error) return auth.error;
  const vendor = await getVendorByEmail(auth.session!.email);
  if (!vendor) return NextResponse.json({ error: "Vendor not found." }, { status: 404 });

  const link = await getVendorSheetLink(vendor.id, true);
  if (!link) return NextResponse.json({ sheets: [] });

  const token = await getVendorGoogleAccessToken(vendor.id);
  const filesUrl =
    "https://www.googleapis.com/drive/v3/files?q=" +
    encodeURIComponent("mimeType='application/vnd.google-apps.spreadsheet' and trashed=false") +
    "&fields=files(id,name,webViewLink)&pageSize=100&orderBy=modifiedTime desc";
  const res = await fetch(filesUrl, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  const json = (await res.json().catch(() => ({}))) as {
    files?: Array<{ id?: string; name?: string; webViewLink?: string }>;
    error?: { message?: string };
  };
  if (!res.ok) {
    return NextResponse.json({ error: json?.error?.message || "Unable to list Google Sheets." }, { status: 400 });
  }
  const sheets = Array.isArray(json.files)
    ? json.files.map((entry) => ({
        id: String(entry.id || ""),
        name: String(entry.name || ""),
        url: String(entry.webViewLink || ""),
      }))
    : [];
  return NextResponse.json({ ok: true, sheets });
}


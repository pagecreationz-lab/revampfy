import { NextResponse } from "next/server";
import { requireSession } from "@/lib/sessionGuard";
import { getVendorByEmail } from "@/lib/vendorPortal";
import {
  deleteVendorSheetLink,
  getVendorSheetLink,
  listVendorSheetSyncLogs,
  upsertVendorSheetLink,
} from "@/lib/vendorSheetLinks";
import { syncVendorSheet, testVendorSheetConnection } from "@/lib/vendorSheetSync";

function extractSpreadsheetIdFromUrl(urlOrId: string): string {
  const raw = String(urlOrId || "").trim();
  if (!raw) return "";
  if (!raw.includes("http")) return raw;
  const match = raw.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  return match?.[1] || "";
}

export async function GET(request: Request) {
  const auth = requireSession(request, "vendor");
  if (auth.error) return auth.error;
  const vendor = await getVendorByEmail(auth.session!.email);
  if (!vendor) return NextResponse.json({ error: "Vendor not found." }, { status: 404 });
  const link = await getVendorSheetLink(vendor.id, true);
  const logs = await listVendorSheetSyncLogs(vendor.id);
  return NextResponse.json({
    ok: true,
    vendorSessionEmail: auth.session!.email,
    link: link
      ? {
          ...link,
          accessToken: link.accessToken ? "********" : "",
          refreshToken: link.refreshToken ? "********" : "",
          googleConnected: Boolean(link.refreshToken || link.accessToken),
        }
      : null,
    logs,
  });
}

export async function POST(request: Request) {
  const auth = requireSession(request, "vendor");
  if (auth.error) return auth.error;
  const vendor = await getVendorByEmail(auth.session!.email);
  if (!vendor) return NextResponse.json({ error: "Vendor not found." }, { status: 404 });

  try {
    const payload = (await request.json()) as {
      action?: "connect" | "sync" | "disconnect" | "test" | "select-sheet" | "set-alt-email";
      sheetUrl?: string;
      sheetId?: string;
      sheetName?: string;
      accessToken?: string;
      refreshToken?: string;
      enabled?: boolean;
      alternateEmail?: string;
    };
    const action = String(payload?.action || "connect");
    if (action === "disconnect") {
      await deleteVendorSheetLink(vendor.id);
      return NextResponse.json({ ok: true });
    }
    if (action === "sync") {
      const link = await getVendorSheetLink(vendor.id, true);
      if (!link?.sheetId) {
        return NextResponse.json({ error: "No Google Sheet assigned to this vendor account." }, { status: 400 });
      }
      const result = await syncVendorSheet(vendor.id);
      const nextLink = await getVendorSheetLink(vendor.id);
      return NextResponse.json({ ok: true, result, link: nextLink });
    }
    if (action === "test") {
      const link = await getVendorSheetLink(vendor.id, true);
      if (!link?.sheetId) {
        return NextResponse.json({ error: "No Google Sheet assigned to this vendor account." }, { status: 400 });
      }
      await testVendorSheetConnection(vendor.id);
      return NextResponse.json({ ok: true, message: "Connection successful." });
    }
    if (action === "set-alt-email") {
      return NextResponse.json(
        { error: "Direct alternate-email grant is disabled. Use Request Access for admin approval." },
        { status: 400 }
      );
    }
    if (action === "select-sheet") {
      const sheetId = String(payload?.sheetId || "").trim();
      if (!sheetId) return NextResponse.json({ error: "sheetId is required." }, { status: 400 });
      const link = await upsertVendorSheetLink({
        vendorId: vendor.id,
        vendorEmail: vendor.email,
        sheetId,
        sheetUrl: String(payload?.sheetUrl || "").trim(),
        sheetName: String(payload?.sheetName || "Sheet1"),
        enabled: typeof payload?.enabled === "boolean" ? payload.enabled : true,
        syncStatus: "inactive",
        lastSyncMessage: "Sheet selected. Run Sync Now.",
      });
      return NextResponse.json({ ok: true, link });
    }

    const sheetUrl = String(payload?.sheetUrl || "").trim();
    const sheetId = String(payload?.sheetId || extractSpreadsheetIdFromUrl(sheetUrl)).trim();
    if (!sheetId) {
      return NextResponse.json({ error: "Valid Google Sheet URL or Sheet ID is required." }, { status: 400 });
    }
    const link = await upsertVendorSheetLink({
      vendorId: vendor.id,
      vendorEmail: vendor.email,
      sheetId,
      sheetUrl,
      sheetName: String(payload?.sheetName || "Sheet1"),
      accessToken: String(payload?.accessToken || ""),
      refreshToken: String(payload?.refreshToken || ""),
      enabled: typeof payload?.enabled === "boolean" ? payload.enabled : true,
      syncStatus: "inactive",
      lastSyncMessage: "Connected. Run Sync Now.",
    });
    return NextResponse.json({ ok: true, link });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to update vendor sheet.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

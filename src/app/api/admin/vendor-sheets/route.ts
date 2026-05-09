import { NextResponse } from "next/server";
import nodemailer from "nodemailer";
import { requireSession } from "@/lib/sessionGuard";
import {
  listVendorSheetLinks,
  listVendorSheetSyncLogs,
  upsertVendorSheetLink,
  deleteVendorSheetLink,
  getVendorSheetLink,
} from "@/lib/vendorSheetLinks";
import { syncVendorSheet, testVendorSheetConnection } from "@/lib/vendorSheetSync";
import { getAdminIntegrationSettings } from "@/lib/adminIntegrations";
import { getEnquirySettings } from "@/lib/enquirySettings";

async function sendSheetAssignmentEmail(input: {
  to: string;
  sheetName: string;
  sheetUrl: string;
}) {
  const settings = await getEnquirySettings();
  const smtpHost = String(settings.smtpHost || "").trim();
  const smtpUser = String(settings.smtpUser || "").trim();
  const smtpPass = String(settings.smtpPass || "").trim();
  const smtpPort = Number(settings.smtpPort || 587);
  const smtpFrom = String(settings.smtpFrom || smtpUser || "").trim();
  if (!smtpHost || !smtpUser || !smtpPass || !smtpFrom) return;

  const transporter = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpPort === 465,
    auth: { user: smtpUser, pass: smtpPass },
  });

  await transporter.sendMail({
    from: smtpFrom,
    to: input.to,
    subject: `Google Sheet assigned: ${input.sheetName}`,
    text:
      `A Google Sheet has been assigned to your vendor account.\n\n` +
      `Sheet: ${input.sheetName}\n` +
      `URL: ${input.sheetUrl}\n\n` +
      `Please open Vendor Portal > Google Sheet Products, update data, save in sheet, then sync.`,
  });
}

export async function GET(request: Request) {
  const auth = requireSession(request, "admin");
  if (auth.error) return auth.error;
  const links = await listVendorSheetLinks();
  const logs = await listVendorSheetSyncLogs();
  return NextResponse.json({ ok: true, links, logs });
}

export async function POST(request: Request) {
  const auth = requireSession(request, "admin");
  if (auth.error) return auth.error;
  try {
    const payload = (await request.json()) as {
      action?: "update" | "sync" | "test" | "disconnect" | "notify";
      vendorId?: string;
      vendorEmail?: string;
      sheetUrl?: string;
      sheetId?: string;
      sheetName?: string;
      enabled?: boolean;
      notifyVendor?: boolean;
    };
    const action = String(payload?.action || "update");
    const vendorId = String(payload?.vendorId || "").trim();
    if (!vendorId) return NextResponse.json({ error: "vendorId is required." }, { status: 400 });

    if (action === "sync") {
      const result = await syncVendorSheet(vendorId);
      return NextResponse.json({ ok: true, result });
    }
    if (action === "test") {
      await testVendorSheetConnection(vendorId);
      return NextResponse.json({ ok: true, message: "Connection successful." });
    }
    if (action === "disconnect") {
      await deleteVendorSheetLink(vendorId);
      return NextResponse.json({ ok: true });
    }
    if (action === "notify") {
      const existing = await getVendorSheetLink(vendorId, true);
      if (!existing?.sheetUrl || !existing?.sheetName) {
        return NextResponse.json({ error: "No sheet assigned for this vendor." }, { status: 400 });
      }
      const to = String(payload?.vendorEmail || existing.vendorEmail || "").trim().toLowerCase();
      if (!to) return NextResponse.json({ error: "Vendor email missing." }, { status: 400 });
      await sendSheetAssignmentEmail({
        to,
        sheetName: existing.sheetName,
        sheetUrl: existing.sheetUrl,
      });
      return NextResponse.json({ ok: true, message: "Notification sent." });
    }

    const existing = await getVendorSheetLink(vendorId, true);
    const admin = await getAdminIntegrationSettings();
    const fallbackAccessToken = String(admin.googleSheets.accessToken || "").trim();
    const fallbackRefreshToken = String(admin.googleSheets.refreshToken || "").trim();
    const fallbackTokenExpiry = Number(admin.googleSheets.tokenExpiry || 0);

    const link = await upsertVendorSheetLink({
      vendorId,
      vendorEmail: String(payload?.vendorEmail || "").trim().toLowerCase(),
      sheetUrl: String(payload?.sheetUrl || "").trim(),
      sheetId: String(payload?.sheetId || "").trim(),
      sheetName: String(payload?.sheetName || "Sheet1").trim() || "Sheet1",
      allowedGoogleEmails: [String(payload?.vendorEmail || "").trim().toLowerCase()],
      enabled: typeof payload?.enabled === "boolean" ? payload.enabled : true,
      syncStatus: "inactive",
      accessToken: String(existing?.accessToken || fallbackAccessToken),
      refreshToken: String(existing?.refreshToken || fallbackRefreshToken),
      tokenExpiry: Number(existing?.tokenExpiry || fallbackTokenExpiry),
    });
    if (Boolean(payload?.notifyVendor)) {
      try {
        await sendSheetAssignmentEmail({
          to: String(payload?.vendorEmail || "").trim().toLowerCase(),
          sheetName: link.sheetName,
          sheetUrl: link.sheetUrl,
        });
      } catch {
        // Non-blocking: sheet assignment should still succeed even if email fails.
      }
    }
    return NextResponse.json({ ok: true, link });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to update vendor sheet link.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

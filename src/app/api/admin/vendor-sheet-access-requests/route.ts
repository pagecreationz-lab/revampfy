import { NextResponse } from "next/server";
import nodemailer from "nodemailer";
import { requireSession } from "@/lib/sessionGuard";
import {
  listVendorSheetAccessRequests,
  updateVendorSheetAccessRequestStatus,
} from "@/lib/vendorSheetAccessRequests";
import { getVendorSheetLink, upsertVendorSheetLink } from "@/lib/vendorSheetLinks";
import { getEnquirySettings } from "@/lib/enquirySettings";
import { grantGoogleSheetEditorAccess, revokeGoogleSheetEmailAccess } from "@/lib/adminIntegrations";

async function sendAccessDecisionEmail(input: {
  to: string;
  vendorEmail: string;
  requestedGoogleEmail: string;
  action: "approve" | "reject";
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
  const isApproved = input.action === "approve";
  await transporter.sendMail({
    from: smtpFrom,
    to: [input.to, input.vendorEmail].filter(Boolean).join(","),
    subject: isApproved ? "Google Sheet access approved" : "Google Sheet access rejected",
    text: isApproved
      ? `Your access request was approved for ${input.requestedGoogleEmail}.\n\nSheet: ${input.sheetName}\nURL: ${input.sheetUrl}`
      : `Your access request was rejected for ${input.requestedGoogleEmail}.\nPlease contact CMS admin for details.`,
  });
}

export async function GET(request: Request) {
  const auth = requireSession(request, "admin");
  if (auth.error) return auth.error;
  const requests = await listVendorSheetAccessRequests();
  return NextResponse.json({ ok: true, requests });
}

export async function POST(request: Request) {
  const auth = requireSession(request, "admin");
  if (auth.error) return auth.error;
  try {
    const payload = (await request.json()) as {
      requestId?: string;
      action?: "approve" | "reject";
      note?: string;
    };
    const requestId = String(payload?.requestId || "").trim();
    const action = String(payload?.action || "").trim();
    if (!requestId) return NextResponse.json({ error: "requestId is required." }, { status: 400 });
    if (action !== "approve" && action !== "reject") {
      return NextResponse.json({ error: "Invalid action." }, { status: 400 });
    }
    const requests = await listVendorSheetAccessRequests();
    const target = requests.find((r) => r.id === requestId);
    if (!target) return NextResponse.json({ error: "Request not found." }, { status: 404 });

    if (action === "approve") {
      const link = await getVendorSheetLink(target.vendorId, true);
      if (link) {
        await grantGoogleSheetEditorAccess({
          spreadsheetId: link.sheetId || target.sheetId,
          email: target.requestedGoogleEmail,
        });
        const merged = Array.from(
          new Set([target.vendorEmail, ...(link.allowedGoogleEmails || []), target.requestedGoogleEmail])
        ).map((e) => String(e || "").trim().toLowerCase());
        await upsertVendorSheetLink({
          vendorId: link.vendorId,
          vendorEmail: link.vendorEmail,
          allowedGoogleEmails: merged,
          lastSyncMessage: "Google email access approved by admin.",
        });
      }
    } else if (action === "reject") {
      const link = await getVendorSheetLink(target.vendorId, true);
      if (link) {
        await revokeGoogleSheetEmailAccess({
          spreadsheetId: link.sheetId || target.sheetId,
          email: target.requestedGoogleEmail,
        });
        const nextAllowed = (link.allowedGoogleEmails || [])
          .map((entry) => String(entry || "").trim().toLowerCase())
          .filter((entry) => entry && entry !== String(target.requestedGoogleEmail || "").trim().toLowerCase());
        await upsertVendorSheetLink({
          vendorId: link.vendorId,
          vendorEmail: link.vendorEmail,
          allowedGoogleEmails: Array.from(new Set([link.vendorEmail.toLowerCase(), ...nextAllowed])),
          lastSyncMessage: "Google email access rejected by admin.",
        });
      }
    }

    const updated = await updateVendorSheetAccessRequestStatus(
      requestId,
      action === "approve" ? "approved" : "rejected",
      payload?.note
    );
    try {
      await sendAccessDecisionEmail({
        to: target.requestedGoogleEmail,
        vendorEmail: target.vendorEmail,
        requestedGoogleEmail: target.requestedGoogleEmail,
        action: action as "approve" | "reject",
        sheetName: target.sheetName,
        sheetUrl: target.sheetUrl,
      });
    } catch {
      // Non-blocking: approval action should succeed even if email fails.
    }
    return NextResponse.json({ ok: true, request: updated });
  } catch (error) {
    const rawMessage = error instanceof Error ? error.message : "Unable to update access request.";
    const message =
      /insufficient authentication scopes/i.test(rawMessage) ||
      /missing google drive scope/i.test(rawMessage)
        ? "Google token is missing Drive permission scope. In CMS Admin > Google Sheet Integration, click Connect Google, approve all permissions, then retry Re-Grant."
        : rawMessage;
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

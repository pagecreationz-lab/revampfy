import { NextResponse } from "next/server";
import { requireSession } from "@/lib/sessionGuard";
import { getAdminIntegrationSettings, getGoogleSheetsAccessToken } from "@/lib/adminIntegrations";

export async function POST(request: Request) {
  const auth = requireSession(request, "admin");
  if (auth.error) return auth.error;

  try {
    const settings = await getAdminIntegrationSettings();
    if (!settings.googleSheets.spreadsheetId) {
      return NextResponse.json({ error: "Spreadsheet ID is missing." }, { status: 400 });
    }
    const token = await getGoogleSheetsAccessToken();
    const range = encodeURIComponent(`${settings.googleSheets.sheetName || "Sheet1"}!A1:A2`);
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(settings.googleSheets.spreadsheetId)}/values/${range}`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      return NextResponse.json({ error: json?.error?.message || "Unable to access Google Sheet." }, { status: 400 });
    }
    return NextResponse.json({ ok: true, message: "Google Sheet connection is valid." });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Google Sheets test failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}


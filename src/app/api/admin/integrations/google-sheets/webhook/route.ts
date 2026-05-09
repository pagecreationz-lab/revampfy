import { NextResponse } from "next/server";
import { getAdminIntegrationSettings } from "@/lib/adminIntegrations";
import { runGoogleSheetSync } from "@/lib/googleSheetsSync";

export async function POST(request: Request) {
  const settings = await getAdminIntegrationSettings();
  const configured = String(settings.googleSheets.webhookSecret || "").trim();
  if (!configured) {
    return NextResponse.json({ error: "Webhook secret is not configured." }, { status: 403 });
  }

  const incoming =
    String(request.headers.get("x-sync-secret") || "").trim() ||
    String(new URL(request.url).searchParams.get("secret") || "").trim();
  if (!incoming || incoming !== configured) {
    return NextResponse.json({ error: "Invalid webhook secret." }, { status: 401 });
  }

  try {
    const result = await runGoogleSheetSync(settings.googleSheets.sheetName);
    return NextResponse.json({ ok: true, ...result, triggeredBy: "webhook" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Webhook sync failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

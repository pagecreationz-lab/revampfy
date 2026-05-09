import { NextResponse } from "next/server";
import { requireSession } from "@/lib/sessionGuard";
import { getAdminIntegrationSettings, saveAdminIntegrationSettings, appendGoogleSheetsSyncLog } from "@/lib/adminIntegrations";
import { runGoogleSheetSync } from "@/lib/googleSheetsSync";

export async function POST(request: Request) {
  const auth = requireSession(request, "admin");
  if (auth.error) return auth.error;

  try {
    const payload = (await request.json().catch(() => ({}))) as { sheetName?: string };
    const result = await runGoogleSheetSync(payload.sheetName);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to sync from Google Sheets.";
    const settings = await getAdminIntegrationSettings();
    await saveAdminIntegrationSettings({
      googleSheets: {
        ...settings.googleSheets,
        lastSyncAt: new Date().toISOString(),
        lastSyncStatus: "error",
        lastSyncMessage: message,
      },
    });
    await appendGoogleSheetsSyncLog({
      status: "error",
      message,
      vendorsProcessed: 0,
      productsProcessed: 0,
    });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET(request: Request) {
  const auth = requireSession(request, "admin");
  if (auth.error) return auth.error;

  const settings = await getAdminIntegrationSettings();
  if (!settings.googleSheets.autoSyncEnabled) {
    return NextResponse.json({ ok: true, skipped: true, reason: "auto_sync_disabled" });
  }
  try {
    const result = await runGoogleSheetSync(settings.googleSheets.sheetName);
    return NextResponse.json({ ok: true, ...result, auto: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Auto sync failed.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}


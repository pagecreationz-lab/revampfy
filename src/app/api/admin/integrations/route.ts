import { NextResponse } from "next/server";
import { requireSession } from "@/lib/sessionGuard";
import {
  getGoogleSheetsSyncLogs,
  getAdminIntegrationSettings,
  saveAdminIntegrationSettings,
  toAdminIntegrationPublicView,
} from "@/lib/adminIntegrations";

export async function GET(request: Request) {
  const auth = requireSession(request, "admin");
  if (auth.error) return auth.error;

  const settings = await getAdminIntegrationSettings();
  const logs = await getGoogleSheetsSyncLogs();
  return NextResponse.json({ ok: true, settings: toAdminIntegrationPublicView(settings), logs });
}

export async function POST(request: Request) {
  const auth = requireSession(request, "admin");
  if (auth.error) return auth.error;

  try {
    const payload = await request.json();
    const saved = await saveAdminIntegrationSettings(payload || {});
    return NextResponse.json({ ok: true, settings: toAdminIntegrationPublicView(saved) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to save integration settings.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

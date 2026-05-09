import { NextResponse } from "next/server";
import { requireSession } from "@/lib/sessionGuard";
import { getAdminIntegrationSettings } from "@/lib/adminIntegrations";

export async function POST(request: Request) {
  const auth = requireSession(request, "admin");
  if (auth.error) return auth.error;

  try {
    const settings = await getAdminIntegrationSettings();
    if (!settings.n8n.baseUrl) {
      return NextResponse.json({ error: "n8n base URL is not configured." }, { status: 400 });
    }
    const endpoint = `${settings.n8n.baseUrl.replace(/\/+$/, "")}/healthz`;
    const response = await fetch(endpoint, {
      headers: settings.n8n.apiKey ? { "X-N8N-API-KEY": settings.n8n.apiKey } : undefined,
    });

    const text = await response.text().catch(() => "");
    return NextResponse.json({
      ok: response.ok,
      status: response.status,
      endpoint,
      response: text.slice(0, 500),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to test n8n connection.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}


import { NextResponse } from "next/server";
import { requireSession } from "@/lib/sessionGuard";
import { getAdminIntegrationSettings } from "@/lib/adminIntegrations";

export async function GET(request: Request) {
  const auth = requireSession(request, "admin");
  if (auth.error) return auth.error;

  const settings = await getAdminIntegrationSettings();
  const origin = new URL(request.url).origin;
  const effectiveRedirectUri =
    settings.googleSheets.redirectUri ||
    `${origin}/api/admin/integrations/google-sheets/oauth/callback`;

  return NextResponse.json({
    ok: true,
    googleSheets: {
      enabled: settings.googleSheets.enabled,
      clientIdPresent: Boolean(settings.googleSheets.clientId),
      clientIdPreview: settings.googleSheets.clientId
        ? `${settings.googleSheets.clientId.slice(0, 18)}...`
        : "",
      clientSecretPresent: Boolean(settings.googleSheets.clientSecret),
      configuredRedirectUri: settings.googleSheets.redirectUri || "",
      effectiveRedirectUri,
      connectedEmail: settings.googleSheets.connectedEmail || "",
    },
  });
}


import { getAuthSettings, maskSecret, saveAuthSettings } from "@/lib/authSettings";

export async function GET() {
  const settings = await getAuthSettings();
  return Response.json({
    settings: {
      enableEmailPasswordLogin: settings.enableEmailPasswordLogin,
      enableEmailCodeLogin: settings.enableEmailCodeLogin,
      enableGoogleLogin: settings.enableGoogleLogin,
      googleClientId: settings.googleClientId,
      googleRedirectUri: settings.googleRedirectUri,
      maskedGoogleClientSecret: maskSecret(settings.googleClientSecret),
    },
  });
}

export async function POST(request: Request) {
  const payload = await request.json();
  const settings = await saveAuthSettings({
    enableEmailPasswordLogin:
      typeof payload?.enableEmailPasswordLogin === "boolean"
        ? payload.enableEmailPasswordLogin
        : undefined,
    enableEmailCodeLogin:
      typeof payload?.enableEmailCodeLogin === "boolean"
        ? payload.enableEmailCodeLogin
        : undefined,
    enableGoogleLogin:
      typeof payload?.enableGoogleLogin === "boolean" ? payload.enableGoogleLogin : undefined,
    googleClientId: typeof payload?.googleClientId === "string" ? payload.googleClientId : "",
    googleClientSecret:
      typeof payload?.googleClientSecret === "string" ? payload.googleClientSecret : undefined,
    googleRedirectUri:
      typeof payload?.googleRedirectUri === "string" ? payload.googleRedirectUri : "",
  });

  return Response.json({
    settings: {
      enableEmailPasswordLogin: settings.enableEmailPasswordLogin,
      enableEmailCodeLogin: settings.enableEmailCodeLogin,
      enableGoogleLogin: settings.enableGoogleLogin,
      googleClientId: settings.googleClientId,
      googleRedirectUri: settings.googleRedirectUri,
      maskedGoogleClientSecret: maskSecret(settings.googleClientSecret),
    },
  });
}

import { getAuthSettings, maskSecret, saveAuthSettings } from "@/lib/authSettings";

export async function GET() {
  const settings = await getAuthSettings();
  return Response.json({
    settings: {
      enableEmailPasswordLogin: settings.enableEmailPasswordLogin,
      enableEmailCodeLogin: settings.enableEmailCodeLogin,
      enableMobileOtpLogin: settings.enableMobileOtpLogin,
      enableGoogleLogin: settings.enableGoogleLogin,
      googleClientId: settings.googleClientId,
      googleRedirectUri: settings.googleRedirectUri,
      maskedGoogleClientSecret: maskSecret(settings.googleClientSecret),
      twilioAccountSid: settings.twilioAccountSid,
      twilioVerifyServiceSid: settings.twilioVerifyServiceSid,
      maskedTwilioAuthToken: maskSecret(settings.twilioAuthToken),
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
    enableMobileOtpLogin:
      typeof payload?.enableMobileOtpLogin === "boolean"
        ? payload.enableMobileOtpLogin
        : undefined,
    enableGoogleLogin:
      typeof payload?.enableGoogleLogin === "boolean" ? payload.enableGoogleLogin : undefined,
    googleClientId:
      typeof payload?.googleClientId === "string" ? payload.googleClientId : undefined,
    googleClientSecret:
      typeof payload?.googleClientSecret === "string" ? payload.googleClientSecret : undefined,
    googleRedirectUri:
      typeof payload?.googleRedirectUri === "string" ? payload.googleRedirectUri : undefined,
    twilioAccountSid:
      typeof payload?.twilioAccountSid === "string" ? payload.twilioAccountSid : undefined,
    twilioAuthToken:
      typeof payload?.twilioAuthToken === "string" ? payload.twilioAuthToken : undefined,
    twilioVerifyServiceSid:
      typeof payload?.twilioVerifyServiceSid === "string"
        ? payload.twilioVerifyServiceSid
        : undefined,
  });

  return Response.json({
    settings: {
      enableEmailPasswordLogin: settings.enableEmailPasswordLogin,
      enableEmailCodeLogin: settings.enableEmailCodeLogin,
      enableMobileOtpLogin: settings.enableMobileOtpLogin,
      enableGoogleLogin: settings.enableGoogleLogin,
      googleClientId: settings.googleClientId,
      googleRedirectUri: settings.googleRedirectUri,
      maskedGoogleClientSecret: maskSecret(settings.googleClientSecret),
      twilioAccountSid: settings.twilioAccountSid,
      twilioVerifyServiceSid: settings.twilioVerifyServiceSid,
      maskedTwilioAuthToken: maskSecret(settings.twilioAuthToken),
    },
  });
}

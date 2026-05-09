import { getAuthSettings, maskSecret, saveAuthSettings } from "@/lib/authSettings";

export async function GET() {
  const settings = await getAuthSettings();
  return Response.json({
    settings: {
      enableEmailPasswordLogin: settings.enableEmailPasswordLogin,
      enableEmailCodeLogin: settings.enableEmailCodeLogin,
      enableMobileOtpLogin: settings.enableMobileOtpLogin,
      enableGoogleLogin: settings.enableGoogleLogin,
      defaultSignInMethod: settings.defaultSignInMethod,
      vendorEnableEmailPasswordLogin: settings.vendorEnableEmailPasswordLogin,
      vendorEnableEmailCodeLogin: settings.vendorEnableEmailCodeLogin,
      vendorDefaultSignInMethod: settings.vendorDefaultSignInMethod,
      googleClientId: settings.googleClientId,
      googleRedirectUri: settings.googleRedirectUri,
      maskedGoogleClientSecret: maskSecret(settings.googleClientSecret),
      twilioAccountSid: settings.twilioAccountSid,
      twilioVerifyServiceSid: settings.twilioVerifyServiceSid,
      maskedTwilioAuthToken: maskSecret(settings.twilioAuthToken),
      mobileOtpProvider: settings.mobileOtpProvider,
      fast2smsSenderId: settings.fast2smsSenderId,
      maskedFast2smsApiKey: maskSecret(settings.fast2smsApiKey),
      twofactorTemplateName: settings.twofactorTemplateName,
      maskedTwofactorApiKey: maskSecret(settings.twofactorApiKey),
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
    defaultSignInMethod:
      payload?.defaultSignInMethod === "emailPassword" ||
      payload?.defaultSignInMethod === "emailCode" ||
      payload?.defaultSignInMethod === "mobileOtp" ||
      payload?.defaultSignInMethod === "google"
        ? payload.defaultSignInMethod
        : undefined,
    vendorEnableEmailPasswordLogin:
      typeof payload?.vendorEnableEmailPasswordLogin === "boolean"
        ? payload.vendorEnableEmailPasswordLogin
        : undefined,
    vendorEnableEmailCodeLogin:
      typeof payload?.vendorEnableEmailCodeLogin === "boolean"
        ? payload.vendorEnableEmailCodeLogin
        : undefined,
    vendorDefaultSignInMethod:
      payload?.vendorDefaultSignInMethod === "emailPassword" ||
      payload?.vendorDefaultSignInMethod === "emailCode"
        ? payload.vendorDefaultSignInMethod
        : undefined,
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
    mobileOtpProvider:
      payload?.mobileOtpProvider === "fast2sms" ||
      payload?.mobileOtpProvider === "twilio" ||
      payload?.mobileOtpProvider === "twofactor"
        ? payload.mobileOtpProvider
        : undefined,
    fast2smsApiKey:
      typeof payload?.fast2smsApiKey === "string" ? payload.fast2smsApiKey : undefined,
    fast2smsSenderId:
      typeof payload?.fast2smsSenderId === "string" ? payload.fast2smsSenderId : undefined,
    twofactorApiKey:
      typeof payload?.twofactorApiKey === "string" ? payload.twofactorApiKey : undefined,
    twofactorTemplateName:
      typeof payload?.twofactorTemplateName === "string" ? payload.twofactorTemplateName : undefined,
  });

  return Response.json({
    settings: {
      enableEmailPasswordLogin: settings.enableEmailPasswordLogin,
      enableEmailCodeLogin: settings.enableEmailCodeLogin,
      enableMobileOtpLogin: settings.enableMobileOtpLogin,
      enableGoogleLogin: settings.enableGoogleLogin,
      defaultSignInMethod: settings.defaultSignInMethod,
      vendorEnableEmailPasswordLogin: settings.vendorEnableEmailPasswordLogin,
      vendorEnableEmailCodeLogin: settings.vendorEnableEmailCodeLogin,
      vendorDefaultSignInMethod: settings.vendorDefaultSignInMethod,
      googleClientId: settings.googleClientId,
      googleRedirectUri: settings.googleRedirectUri,
      maskedGoogleClientSecret: maskSecret(settings.googleClientSecret),
      twilioAccountSid: settings.twilioAccountSid,
      twilioVerifyServiceSid: settings.twilioVerifyServiceSid,
      maskedTwilioAuthToken: maskSecret(settings.twilioAuthToken),
      mobileOtpProvider: settings.mobileOtpProvider,
      fast2smsSenderId: settings.fast2smsSenderId,
      maskedFast2smsApiKey: maskSecret(settings.fast2smsApiKey),
      twofactorTemplateName: settings.twofactorTemplateName,
      maskedTwofactorApiKey: maskSecret(settings.twofactorApiKey),
    },
  });
}

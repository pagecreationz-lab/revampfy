import { getAuthSettings } from "@/lib/authSettings";

export async function GET() {
  const settings = await getAuthSettings();
  const googleConfigured = Boolean(settings.googleClientId && settings.googleClientSecret);
  const mobileOtpConfigured = Boolean(
    settings.twilioAccountSid && settings.twilioAuthToken && settings.twilioVerifyServiceSid
  );
  const mobileOtpEnabled = Boolean(settings.enableMobileOtpLogin);
  const googleEnabled = Boolean(settings.enableGoogleLogin);
  return Response.json({
    methods: {
      emailPassword: settings.enableEmailPasswordLogin,
      emailCode: settings.enableEmailCodeLogin,
      mobileOtp: mobileOtpEnabled,
      google: googleEnabled,
    },
    diagnostics: {
      mobileOtpEnabled,
      mobileOtpConfigured,
      googleEnabled,
      googleConfigured,
    },
  });
}

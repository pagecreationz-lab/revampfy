import { getAuthSettings } from "@/lib/authSettings";

export async function GET() {
  const settings = await getAuthSettings();
  const googleConfigured = Boolean(settings.googleClientId && settings.googleClientSecret);
  return Response.json({
    methods: {
      emailPassword: settings.enableEmailPasswordLogin,
      emailCode: settings.enableEmailCodeLogin,
      google: settings.enableGoogleLogin && googleConfigured,
    },
  });
}

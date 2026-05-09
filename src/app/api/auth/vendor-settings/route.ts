import { getAuthSettings } from "@/lib/authSettings";

export async function GET() {
  const settings = await getAuthSettings();
  return Response.json({
    methods: {
      emailPassword: Boolean(settings.vendorEnableEmailPasswordLogin),
      emailCode: Boolean(settings.vendorEnableEmailCodeLogin),
    },
    defaultSignInMethod: settings.vendorDefaultSignInMethod,
  });
}


import { getAuthSettings } from "@/lib/authSettings";

function toBasicAuth(username: string, password: string) {
  return Buffer.from(`${username}:${password}`).toString("base64");
}

type TwilioServiceProbe = {
  sid?: string;
  friendly_name?: string;
  account_sid?: string;
};

export async function POST(request: Request) {
  try {
    const payload = await request.json().catch(() => ({}));
    const current = await getAuthSettings();

    const accountSid =
      typeof payload?.twilioAccountSid === "string" && payload.twilioAccountSid.trim()
        ? payload.twilioAccountSid.trim()
        : current.twilioAccountSid;
    const authToken =
      typeof payload?.twilioAuthToken === "string" && payload.twilioAuthToken.trim()
        ? payload.twilioAuthToken.trim()
        : current.twilioAuthToken;
    const verifyServiceSid =
      typeof payload?.twilioVerifyServiceSid === "string" && payload.twilioVerifyServiceSid.trim()
        ? payload.twilioVerifyServiceSid.trim()
        : current.twilioVerifyServiceSid;

    if (!accountSid || !authToken || !verifyServiceSid) {
      return Response.json(
        {
          ok: false,
          error:
            "Twilio test needs Account SID, Auth Token, and Verify Service SID (VA...).",
        },
        { status: 400 }
      );
    }

    const endpoint = `https://verify.twilio.com/v2/Services/${encodeURIComponent(
      verifyServiceSid
    )}`;

    const res = await fetch(endpoint, {
      method: "GET",
      headers: {
        Authorization: `Basic ${toBasicAuth(accountSid, authToken)}`,
        "Content-Type": "application/json",
      },
      cache: "no-store",
    });

    if (!res.ok) {
      const text = await res.text();
      return Response.json(
        {
          ok: false,
          error: `Twilio credentials test failed (${res.status}): ${text || res.statusText}`,
        },
        { status: 400 }
      );
    }

    const probe = (await res.json()) as TwilioServiceProbe;
    return Response.json({
      ok: true,
      message: `Twilio verified. Service: ${probe.friendly_name || probe.sid || verifyServiceSid}`,
      service: {
        sid: probe.sid || verifyServiceSid,
        friendlyName: probe.friendly_name || "",
        accountSid: probe.account_sid || accountSid,
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to test Twilio credentials.";
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}


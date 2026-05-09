import { NextResponse } from "next/server";

function toText(value: unknown): string {
  return String(value || "").trim();
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const lat = toText(searchParams.get("lat"));
    const lng = toText(searchParams.get("lng"));
    if (!lat || !lng) {
      return NextResponse.json({ error: "lat and lng are required." }, { status: 400 });
    }

    const upstream = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lng)}`,
      {
        headers: {
          "User-Agent": "RevampfyCMS/1.0 (support@revampfy.in)",
          Accept: "application/json",
        },
        cache: "no-store",
      }
    );
    const json = (await upstream.json().catch(() => null)) as
      | {
          display_name?: string;
          address?: {
            house_number?: string;
            road?: string;
            suburb?: string;
            neighbourhood?: string;
            city?: string;
            town?: string;
            village?: string;
            state?: string;
            postcode?: string;
          };
        }
      | null;
    if (!upstream.ok || !json) {
      return NextResponse.json({ error: "Unable to resolve location." }, { status: 502 });
    }

    const address = json.address || {};
    const street = [toText(address.house_number), toText(address.road)].filter(Boolean).join(" ");
    const area = toText(address.suburb || address.neighbourhood);
    const city = toText(address.city || address.town || address.village);
    const state = toText(address.state);
    const pincode = toText(address.postcode);

    return NextResponse.json({
      ok: true,
      location: {
        lat,
        lng,
        street,
        area,
        city,
        state,
        pincode,
        fullAddress: toText(json.display_name),
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to resolve location.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}


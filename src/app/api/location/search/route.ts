import { NextResponse } from "next/server";

function text(value: unknown): string {
  return String(value || "").trim();
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const q = text(searchParams.get("q"));
    if (!q || q.length < 3) {
      return NextResponse.json({ ok: true, suggestions: [] });
    }

    const upstream = await fetch(
      `https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=6&q=${encodeURIComponent(q)}`,
      {
        headers: {
          "User-Agent": "RevampfyCMS/1.0 (support@revampfy.in)",
          Accept: "application/json",
        },
        cache: "no-store",
      }
    );
    const data = (await upstream.json().catch(() => [])) as Array<{
      display_name?: string;
      lat?: string;
      lon?: string;
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
    }>;
    if (!upstream.ok || !Array.isArray(data)) {
      return NextResponse.json({ error: "Unable to search address." }, { status: 502 });
    }

    const suggestions = data.map((entry) => {
      const addr = entry.address || {};
      const street = [text(addr.house_number), text(addr.road)].filter(Boolean).join(" ");
      const area = text(addr.suburb || addr.neighbourhood);
      const city = text(addr.city || addr.town || addr.village);
      const state = text(addr.state);
      const pincode = text(addr.postcode);
      return {
        label: text(entry.display_name),
        lat: text(entry.lat),
        lng: text(entry.lon),
        street,
        area,
        city,
        state,
        pincode,
      };
    });

    return NextResponse.json({ ok: true, suggestions });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to search address.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}


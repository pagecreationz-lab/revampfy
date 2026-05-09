import { NextResponse } from "next/server";
import { listStoresByState } from "@/lib/vendorPortal";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const state = url.searchParams.get("state") || "";
    const stores = await listStoresByState(state);
    return NextResponse.json({ ok: true, stores });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to fetch vendor stores.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

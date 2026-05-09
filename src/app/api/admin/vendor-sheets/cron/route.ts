import { NextResponse } from "next/server";
import { syncAllVendorsSheets } from "@/lib/vendorSheetSync";

export async function GET(request: Request) {
  const token = String(new URL(request.url).searchParams.get("token") || "");
  const expected = String(process.env.VENDOR_SHEETS_CRON_TOKEN || "");
  if (!expected || token !== expected) {
    return NextResponse.json({ error: "Unauthorized cron token." }, { status: 401 });
  }
  const result = await syncAllVendorsSheets();
  return NextResponse.json({ ok: true, ...result });
}


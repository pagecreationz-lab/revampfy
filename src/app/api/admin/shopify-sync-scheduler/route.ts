import { NextResponse } from "next/server";
import {
  getShopifySyncSchedulerSettings,
  saveShopifySyncSchedulerSettings,
  type ShopifySyncSchedulerMode,
} from "@/lib/shopifySyncScheduler";

export async function GET() {
  const settings = await getShopifySyncSchedulerSettings();
  return NextResponse.json({ settings });
}

export async function POST(request: Request) {
  const payload = await request.json();
  const mode: ShopifySyncSchedulerMode = payload.mode === "hourly" ? "hourly" : "manual";
  const settings = await saveShopifySyncSchedulerSettings({ mode });
  return NextResponse.json({ settings });
}


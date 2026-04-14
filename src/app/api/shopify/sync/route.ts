import { getEffectiveShopifySyncStore } from "@/lib/shopifySyncRuntime";

export async function GET() {
  try {
    const store = await getEffectiveShopifySyncStore();
    return Response.json({ payload: store.payload, cached: store });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return Response.json({ error: message }, { status: 500 });
  }
}

export async function POST() {
  try {
    const saved = await getEffectiveShopifySyncStore({ forceSync: true });
    return Response.json({ saved });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return Response.json({ error: message }, { status: 500 });
  }
}


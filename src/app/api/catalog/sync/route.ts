import { getCatalogSyncPayload } from "@/lib/catalog";
import { saveCatalogSyncStore } from "@/lib/catalogSync";

export async function GET() {
  try {
    const payload = await getCatalogSyncPayload();
    return Response.json(
      { payload },
      {
        headers: {
          "Cache-Control": "public, max-age=60, stale-while-revalidate=300",
        },
      }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return Response.json({ error: message }, { status: 500 });
  }
}

export async function POST() {
  try {
    const payload = await getCatalogSyncPayload();
    const saved = await saveCatalogSyncStore(payload);
    return Response.json({ saved });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return Response.json({ error: message }, { status: 500 });
  }
}



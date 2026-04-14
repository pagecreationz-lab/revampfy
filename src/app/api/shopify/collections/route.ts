import { getCollections, updateCollection } from "@/lib/shopify";

export async function GET() {
  try {
    const collections = await getCollections();
    return Response.json({ collections });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return Response.json({ error: message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const payload = await request.json();
    const id = Number(payload.id);

    if (!id || Number.isNaN(id)) {
      return Response.json({ error: "Invalid collection id" }, { status: 400 });
    }

    const collection = await updateCollection({
      id,
      title: payload.title,
      body_html: payload.body_html,
      collection_type: payload.collection_type,
    });

    return Response.json({ collection });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return Response.json({ error: message }, { status: 500 });
  }
}

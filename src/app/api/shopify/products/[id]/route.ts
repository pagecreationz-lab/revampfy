import { updateProduct } from "@/lib/shopify";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params;
    const payload = await request.json();
    const id = Number(resolvedParams.id);

    if (!id || Number.isNaN(id)) {
      return Response.json({ error: "Invalid product id" }, { status: 400 });
    }

    const product = await updateProduct({
      id,
      title: payload.title,
      tags: payload.tags,
      status: payload.status,
    });

    return Response.json({ product });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return Response.json({ error: message }, { status: 500 });
  }
}

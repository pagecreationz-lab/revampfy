import { getProducts } from "@/lib/shopify";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = Number(searchParams.get("limit")) || 25;
    const pageInfo = searchParams.get("pageInfo") || undefined;

    const { products, pageInfo: page } = await getProducts({ limit, pageInfo });
    return Response.json({ products, pageInfo: page });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return Response.json({ error: message }, { status: 500 });
  }
}

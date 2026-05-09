import { NextResponse } from "next/server";
import { deleteCatalogProduct, replaceCatalogProduct } from "@/lib/catalog";
import { getVendorPortalData } from "@/lib/vendorPortal";

export const dynamic = "force-dynamic";

export async function PUT(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const productId = Number(id);
    if (!Number.isFinite(productId) || productId <= 0) {
      return NextResponse.json({ error: "Invalid product id." }, { status: 400 });
    }

    const payload = (await request.json()) as Record<string, unknown>;
    const vendorId = String(payload.vendorId || "").trim();
    const vendorName = typeof payload.vendor === "string" ? payload.vendor.trim() : "";
    const portal = await getVendorPortalData();
    const vendorRecord = vendorId
      ? portal.vendors.find((vendor) => vendor.id === vendorId)
      : portal.vendors.find((vendor) => vendor.name.trim().toLowerCase() === vendorName.toLowerCase());
    const resolvedVendorId = vendorRecord?.id || vendorId;
    const resolvedVendorName = vendorRecord?.name || vendorName;
    const product = await replaceCatalogProduct(productId, {
      title: typeof payload.title === "string" ? payload.title : undefined,
      handle: typeof payload.handle === "string" ? payload.handle : undefined,
      description: typeof payload.description === "string" ? payload.description : undefined,
      description_html:
        typeof payload.description_html === "string" ? payload.description_html : undefined,
      status: typeof payload.status === "string" ? payload.status : undefined,
      tags: typeof payload.tags === "string" ? payload.tags : undefined,
      vendor: resolvedVendorName || undefined,
      product_type: typeof payload.product_type === "string" ? payload.product_type : undefined,
      category: typeof payload.category === "string" ? payload.category : undefined,
      collection_handles: Array.isArray(payload.collection_handles)
        ? payload.collection_handles.map((entry) => String(entry))
        : undefined,
      images: Array.isArray(payload.images)
        ? payload.images.map((image) => ({ src: String((image as { src?: string })?.src || "") }))
        : undefined,
      variants: Array.isArray(payload.variants)
        ? payload.variants.map((variant) => ({
            id: Number((variant as { id?: number })?.id || 0) || undefined,
            title: String((variant as { title?: string })?.title || ""),
            price: String((variant as { price?: string | number })?.price || "0"),
            compare_at_price:
              (variant as { compare_at_price?: string | null })?.compare_at_price || null,
            inventory_quantity: Number((variant as { inventory_quantity?: number })?.inventory_quantity || 0),
            requires_shipping: Boolean((variant as { requires_shipping?: boolean })?.requires_shipping),
          }))
        : undefined,
      metafields: [
        ...(Array.isArray(payload.metafields)
          ? payload.metafields.map((item) => ({
            namespace: String((item as { namespace?: string })?.namespace || "custom"),
            key: String((item as { key?: string })?.key || ""),
            value: String((item as { value?: string })?.value || ""),
            type: String((item as { type?: string })?.type || ""),
          }))
          : []),
        ...(resolvedVendorId
          ? [{ namespace: "vendor", key: "vendor_id", value: resolvedVendorId, type: "single_line_text_field" }]
          : []),
      ],
    });
    return NextResponse.json({ ok: true, product });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to update product.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const productId = Number(id);
    if (!Number.isFinite(productId) || productId <= 0) {
      return NextResponse.json({ error: "Invalid product id." }, { status: 400 });
    }
    await deleteCatalogProduct(productId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to delete product.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { createCatalogProduct, getProducts } from "@/lib/catalog";
import { getVendorPortalData } from "@/lib/vendorPortal";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { products } = await getProducts({ limit: 250, status: "any", vendorManagedOnly: true });
    return NextResponse.json({ products });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load catalog.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as Record<string, unknown>;
    const vendorId = String(payload.vendorId || "").trim();
    const vendorName = String(payload.vendor || "").trim();
    const portal = await getVendorPortalData();
    const vendorRecord = vendorId
      ? portal.vendors.find((vendor) => vendor.id === vendorId)
      : portal.vendors.find((vendor) => vendor.name.trim().toLowerCase() === vendorName.toLowerCase());
    const resolvedVendorId = vendorRecord?.id || vendorId;
    const resolvedVendorName = vendorRecord?.name || vendorName;
    const product = await createCatalogProduct({
      title: String(payload.title || "New Product"),
      handle: String(payload.handle || ""),
      description: String(payload.description || ""),
      description_html: String(payload.description_html || ""),
      status: String(payload.status || "active"),
      tags: String(payload.tags || ""),
      vendor: resolvedVendorName,
      product_type: String(payload.product_type || ""),
      category: String(payload.category || ""),
      collection_handles: Array.isArray(payload.collection_handles)
        ? payload.collection_handles.map((entry) => String(entry))
        : [],
      images: Array.isArray(payload.images)
        ? payload.images.map((image) => ({ src: String((image as { src?: string })?.src || "") }))
        : [],
      variants: Array.isArray(payload.variants)
        ? payload.variants.map((variant) => ({
            id: Number((variant as { id?: number })?.id || 0) || undefined,
            title: String((variant as { title?: string })?.title || ""),
            price: String((variant as { price?: string | number })?.price || "0"),
            compare_at_price: (variant as { compare_at_price?: string | null })?.compare_at_price || null,
            inventory_quantity: Number((variant as { inventory_quantity?: number })?.inventory_quantity || 0),
            requires_shipping: Boolean((variant as { requires_shipping?: boolean })?.requires_shipping),
          }))
        : [],
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
    const message = error instanceof Error ? error.message : "Unable to create product.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}


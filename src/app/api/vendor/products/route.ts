import { NextResponse } from "next/server";
import { createCatalogProduct, deleteCatalogProduct, getProducts, getProductById, replaceCatalogProduct } from "@/lib/catalog";
import { requireSession } from "@/lib/sessionGuard";
import { getVendorByEmail, getVendorStores } from "@/lib/vendorPortal";

function parseTags(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function toTagsString(tags: string[]) {
  return Array.from(new Set(tags.filter(Boolean))).join(", ");
}

function asString(value: unknown) {
  return String(value || "").trim();
}

type SpecsGroup = Record<string, string>;

type RequiredSpecs = {
  performance: SpecsGroup;
  software: SpecsGroup;
  moreInfo: SpecsGroup;
};

const REQUIRED_SPEC_FIELDS = {
  performance: [
    "Memory Technology",
    "Display Resolution",
    "Processor Family",
    "Graphics Card Type",
    "Storage Types Supported",
  ],
  software: ["Cosmetic Condition"],
  moreInfo: [
    "Color Pattern",
    "Operating System",
    "Connection Type",
    "Keyboard Type",
    "Brand",
    "Model",
    "Category",
  ],
} as const;

function normalizeSpecsGroup(input: unknown): SpecsGroup {
  const value = input && typeof input === "object" ? (input as Record<string, unknown>) : {};
  return Object.fromEntries(
    Object.entries(value).map(([key, val]) => [String(key).trim(), asString(val)])
  );
}

function validateAndNormalizeSpecs(input: unknown): RequiredSpecs {
  const root = input && typeof input === "object" ? (input as Record<string, unknown>) : {};
  const performance = normalizeSpecsGroup(root.performance);
  const software = normalizeSpecsGroup(root.software);
  const moreInfo = normalizeSpecsGroup(root.moreInfo);

  const missing: string[] = [];
  REQUIRED_SPEC_FIELDS.performance.forEach((field) => {
    if (!asString(performance[field])) missing.push(`performance.${field}`);
  });
  REQUIRED_SPEC_FIELDS.software.forEach((field) => {
    if (!asString(software[field])) missing.push(`software.${field}`);
  });
  REQUIRED_SPEC_FIELDS.moreInfo.forEach((field) => {
    if (!asString(moreInfo[field])) missing.push(`moreInfo.${field}`);
  });

  if (missing.length) {
    throw new Error(`Missing mandatory specifications: ${missing.join(", ")}`);
  }

  return {
    performance: Object.fromEntries(
      REQUIRED_SPEC_FIELDS.performance.map((field) => [field, asString(performance[field])])
    ),
    software: Object.fromEntries(
      REQUIRED_SPEC_FIELDS.software.map((field) => [field, asString(software[field])])
    ),
    moreInfo: Object.fromEntries(
      REQUIRED_SPEC_FIELDS.moreInfo.map((field) => [field, asString(moreInfo[field])])
    ),
  };
}

function ensureVendorOwnsProduct(vendorName: string, productVendor?: string) {
  return String(productVendor || "").trim().toLowerCase() === vendorName.trim().toLowerCase();
}

export async function GET(request: Request) {
  const auth = requireSession(request, "vendor");
  if (auth.error) return auth.error;

  const vendor = await getVendorByEmail(auth.session!.email);
  if (!vendor) {
    return NextResponse.json({ error: "Vendor account not found." }, { status: 404 });
  }

  const { searchParams } = new URL(request.url);
  const limit = Number(searchParams.get("limit") || 250);
  const pageInfo = searchParams.get("pageInfo") || undefined;

  const result = await getProducts({ limit, pageInfo, status: "any" });
  const vendorLower = vendor.name.trim().toLowerCase();
  const products = result.products.filter(
    (item) => String(item.vendor || "").trim().toLowerCase() === vendorLower
  );

  return NextResponse.json({ ok: true, vendor: vendor.name, products, pageInfo: result.pageInfo });
}

export async function POST(request: Request) {
  const auth = requireSession(request, "vendor");
  if (auth.error) return auth.error;

  const vendor = await getVendorByEmail(auth.session!.email);
  if (!vendor) {
    return NextResponse.json({ error: "Vendor account not found." }, { status: 404 });
  }

  try {
    const payload = await request.json();
    const title = String(payload?.title || "").trim();
    const price = String(payload?.price || "0").trim();
    const pincode = String(payload?.pincode || "").trim();
    const state = String(payload?.state || "").trim();
    const category = String(payload?.category || "").trim();
    const brand = String(payload?.brand || payload?.product_type || "").trim();
    const collection = String(payload?.collection || "").trim();
    const tagsInput = String(payload?.tags || "").trim();
    const imagesInput = Array.isArray(payload?.images) ? payload.images : [];
    const variantsInput = Array.isArray(payload?.variants) ? payload.variants : [];
    const specsInput = validateAndNormalizeSpecs(payload?.specs);
    const collectionHandles = collection
      .split(",")
      .map((item) => item.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-"))
      .filter(Boolean);

    if (!title) {
      return NextResponse.json({ error: "Product title is required." }, { status: 400 });
    }

    const stores = await getVendorStores(vendor.id);
    if (state || pincode) {
      const match = stores.some(
        (store) =>
          store.isActive &&
          (!state || store.state.toLowerCase() === state.toLowerCase()) &&
          (!pincode || store.pincode === pincode)
      );
      if (!match) {
        return NextResponse.json(
          { error: "Selected state/pincode must belong to your active service locations." },
          { status: 400 }
        );
      }
    }

    const tags = parseTags(tagsInput);
    if (state) tags.push(`vendorState:${state}`);
    if (pincode) tags.push(`vendorPincode:${pincode}`);

    const product = await createCatalogProduct({
      title,
      handle: String(payload?.handle || title),
      description: String(payload?.description || ""),
      status: String(payload?.status || "active"),
      vendor: vendor.name,
      product_type: brand,
      category,
      collection_handles: collectionHandles,
      tags: toTagsString(tags),
      images: imagesInput
        .map((entry: unknown) => ({ src: asString((entry as { src?: string })?.src || entry) }))
        .filter((entry: { src: string }) => entry.src),
      variants: [
        ...(variantsInput.length
          ? variantsInput.map((variant: unknown) => ({
              title: asString((variant as { title?: string }).title || "Default"),
              price: asString((variant as { price?: string | number }).price || "0"),
              compare_at_price: asString((variant as { compare_at_price?: string | number }).compare_at_price || "") || null,
              inventory_quantity: Number((variant as { inventory_quantity?: number }).inventory_quantity || 0),
            }))
          : [
              {
                title: String(payload?.variantTitle || "Default"),
                price: price || "0",
                compare_at_price: String(payload?.compareAtPrice || "").trim() || null,
                inventory_quantity: Number(payload?.inventoryQuantity || 0),
              },
            ]),
      ],
      metafields: [
        { namespace: "vendor", key: "vendor_id", value: vendor.id, type: "single_line_text_field" },
        { namespace: "vendor", key: "state", value: state, type: "single_line_text_field" },
        { namespace: "vendor", key: "pincode", value: pincode, type: "single_line_text_field" },
        {
          namespace: "specs",
          key: "performance",
          value: JSON.stringify(specsInput.performance),
          type: "json",
        },
        {
          namespace: "specs",
          key: "software",
          value: JSON.stringify(specsInput.software),
          type: "json",
        },
        {
          namespace: "specs",
          key: "moreInfo",
          value: JSON.stringify(specsInput.moreInfo),
          type: "json",
        },
      ].filter((entry) => entry.value),
    });
    return NextResponse.json({
      ok: true,
      product,
      productUrl: `/store/${encodeURIComponent(product.handle || String(product.id))}`,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to create product.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const auth = requireSession(request, "vendor");
  if (auth.error) return auth.error;

  const vendor = await getVendorByEmail(auth.session!.email);
  if (!vendor) {
    return NextResponse.json({ error: "Vendor account not found." }, { status: 404 });
  }

  try {
    const payload = await request.json();
    const productId = Number(payload?.id || 0);
    const title = typeof payload?.title === "string" ? payload.title.trim() : undefined;
    const status = typeof payload?.status === "string" ? payload.status.trim() : undefined;
    const category = typeof payload?.category === "string" ? payload.category.trim() : undefined;
    const brand = typeof payload?.brand === "string" ? payload.brand.trim() : undefined;
    const collection = typeof payload?.collection === "string" ? payload.collection.trim() : undefined;
    const state = typeof payload?.state === "string" ? payload.state.trim() : "";
    const pincode = typeof payload?.pincode === "string" ? payload.pincode.trim() : "";
    const tagsInput = typeof payload?.tags === "string" ? payload.tags.trim() : "";
    const imagesInput = Array.isArray(payload?.images) ? payload.images : undefined;
    const variantsInput = Array.isArray(payload?.variants) ? payload.variants : undefined;
    const specsInput = payload?.specs ? validateAndNormalizeSpecs(payload.specs) : undefined;
    const collectionHandles =
      typeof collection === "string"
        ? collection
            .split(",")
            .map((item) => item.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-"))
            .filter(Boolean)
        : undefined;

    if (!productId) {
      return NextResponse.json({ error: "Product id is required." }, { status: 400 });
    }

    const current = await getProductById(productId);
    if (!current) {
      return NextResponse.json({ error: "Product not found." }, { status: 404 });
    }

    if (!ensureVendorOwnsProduct(vendor.name, current.vendor)) {
      return NextResponse.json({ error: "You can manage only your own products." }, { status: 403 });
    }

    const stores = await getVendorStores(vendor.id);
    if (state || pincode) {
      const match = stores.some(
        (store) =>
          store.isActive &&
          (!state || store.state.toLowerCase() === state.toLowerCase()) &&
          (!pincode || store.pincode === pincode)
      );
      if (!match) {
        return NextResponse.json(
          { error: "Selected state/pincode must belong to your active service locations." },
          { status: 400 }
        );
      }
    }

    const existingTags = parseTags(String(current.tags || ""));
    const preserved = existingTags.filter(
      (item) => !item.toLowerCase().startsWith("vendorstate:") && !item.toLowerCase().startsWith("vendorpincode:")
    );
    const extra = parseTags(tagsInput);
    if (state) extra.push(`vendorState:${state}`);
    if (pincode) extra.push(`vendorPincode:${pincode}`);

    const updated = await replaceCatalogProduct(productId, {
      title,
      status,
      category,
      product_type: brand,
      collection_handles: collectionHandles,
      images: imagesInput
        ? imagesInput
            .map((entry: unknown) => ({ src: asString((entry as { src?: string })?.src || entry) }))
            .filter((entry: { src: string }) => entry.src)
        : undefined,
      variants: variantsInput
        ? variantsInput.map((variant: unknown) => ({
            id: Number((variant as { id?: number }).id || 0) || undefined,
            title: asString((variant as { title?: string }).title || "Default"),
            price: asString((variant as { price?: string | number }).price || "0"),
            compare_at_price:
              asString((variant as { compare_at_price?: string | number }).compare_at_price || "") || null,
            inventory_quantity: Number((variant as { inventory_quantity?: number }).inventory_quantity || 0),
          }))
        : undefined,
      tags: toTagsString([...preserved, ...extra]),
      metafields: [
        ...((current.metafields || []).filter(
          (entry) =>
            !(
              (entry.namespace === "vendor" && (entry.key === "state" || entry.key === "pincode")) ||
              (entry.namespace === "specs" &&
                (entry.key === "performance" || entry.key === "software" || entry.key === "moreInfo"))
            )
        ) || []),
        ...(state ? [{ namespace: "vendor", key: "state", value: state, type: "single_line_text_field" }] : []),
        ...(pincode ? [{ namespace: "vendor", key: "pincode", value: pincode, type: "single_line_text_field" }] : []),
        ...(specsInput
          ? [
              {
                namespace: "specs",
                key: "performance",
                value: JSON.stringify(specsInput.performance),
                type: "json",
              },
              {
                namespace: "specs",
                key: "software",
                value: JSON.stringify(specsInput.software),
                type: "json",
              },
              {
                namespace: "specs",
                key: "moreInfo",
                value: JSON.stringify(specsInput.moreInfo),
                type: "json",
              },
            ]
          : []),
      ],
    });
    return NextResponse.json({
      ok: true,
      product: updated,
      productUrl: `/store/${encodeURIComponent(updated.handle || String(updated.id))}`,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to update product.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const auth = requireSession(request, "vendor");
  if (auth.error) return auth.error;

  const vendor = await getVendorByEmail(auth.session!.email);
  if (!vendor) {
    return NextResponse.json({ error: "Vendor account not found." }, { status: 404 });
  }

  const { searchParams } = new URL(request.url);
  const productId = Number(searchParams.get("id") || 0);
  if (!productId) {
    return NextResponse.json({ error: "Product id is required." }, { status: 400 });
  }

  const current = await getProductById(productId);
  if (!current) {
    return NextResponse.json({ error: "Product not found." }, { status: 404 });
  }
  if (!ensureVendorOwnsProduct(vendor.name, current.vendor)) {
    return NextResponse.json({ error: "You can manage only your own products." }, { status: 403 });
  }

  try {
    await deleteCatalogProduct(productId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to delete product.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { ShopifyProduct } from "@/lib/shopify";
import { addCartItemToStorage } from "@/lib/cart";
import {
  getProductStockQty,
  resolveVariantsFromProduct,
  type ResolvedVariant,
} from "@/lib/product";

type SpecTab = "performance" | "software" | "moreInfo";
type SpecEntry = {
  label: string;
  value: string;
};

function formatPrice(value?: string) {
  if (!value) return "";
  const numberValue = Number(value);
  if (Number.isNaN(numberValue)) return value;
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(numberValue);
}

function normalizeLabel(raw: string) {
  return raw
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function resolveDisplayBrand(product: ShopifyProduct): string {
  const type = (product.product_type || "").trim();
  const category = (product.category || "").trim().toLowerCase();
  const normalizedType = type.toLowerCase();
  if (type && normalizedType !== category && normalizedType !== "laptops" && normalizedType !== "desktop computers") {
    return type;
  }
  return (product.vendor || "").trim();
}

function parseTagSpecs(tagsRaw?: string): SpecEntry[] {
  if (!tagsRaw) return [];
  const tags = tagsRaw
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
  return tags
    .map((tag) => {
      const sep = tag.includes(":") ? ":" : tag.includes("=") ? "=" : "";
      if (!sep) return null;
      const [left, ...rest] = tag.split(sep);
      const label = normalizeLabel(left || "");
      const value = rest.join(sep).trim();
      if (!label || !value) return null;
      return { label, value };
    })
    .filter((entry): entry is SpecEntry => Boolean(entry));
}

function parseDescriptionSpecs(descriptionHtml?: string, description?: string): SpecEntry[] {
  const source = (descriptionHtml || description || "").replace(/<[^>]*>/g, "\n");
  const lines = source
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);
  return lines
    .map((line) => {
      const match = line.match(/^([^:]{2,40}):\s*(.+)$/);
      if (!match) return null;
      const label = normalizeLabel(match[1]);
      const value = match[2].trim();
      if (!label || !value) return null;
      return { label, value };
    })
    .filter((entry): entry is SpecEntry => Boolean(entry));
}

function parseMetafieldSpecs(
  metafields?: Array<{ namespace: string; key: string; value: string; type?: string }>
): SpecEntry[] {
  if (!metafields?.length) return [];
  const entries: SpecEntry[] = [];

  metafields.forEach((metafield) => {
    const rawValue = (metafield.value || "").trim();
    if (!rawValue) return;

    if ((metafield.type || "").includes("json")) {
      try {
        const parsed = JSON.parse(rawValue) as Record<string, unknown>;
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
          Object.entries(parsed).forEach(([key, value]) => {
            if (value === null || value === undefined) return;
            const label = normalizeLabel(key);
            const valueText = String(value).trim();
            if (!label || !valueText) return;
            entries.push({ label, value: valueText });
          });
          return;
        }
      } catch {
        // fallback to plain string handling below
      }
    }

    const keyLabel = normalizeLabel(metafield.key || "");
    if (!keyLabel) return;
    entries.push({ label: keyLabel, value: rawValue });
  });

  return entries;
}

function splitSpecTabs(entries: SpecEntry[]) {
  const performanceHints = [
    "processor",
    "cpu",
    "core",
    "ram",
    "memory",
    "storage",
    "ssd",
    "hdd",
    "gpu",
    "graphics",
    "display",
    "screen",
    "battery",
    "clock",
    "speed",
  ];
  const softwareHints = ["os", "software", "windows", "office", "bios", "firmware", "secure boot"];

  const performance: SpecEntry[] = [];
  const software: SpecEntry[] = [];
  const moreInfo: SpecEntry[] = [];

  entries.forEach((entry) => {
    const key = entry.label.toLowerCase();
    if (performanceHints.some((hint) => key.includes(hint))) {
      performance.push(entry);
      return;
    }
    if (softwareHints.some((hint) => key.includes(hint))) {
      software.push(entry);
      return;
    }
    moreInfo.push(entry);
  });

  return { performance, software, moreInfo };
}

export function ProductDetailClient({
  product,
  isAuthenticated,
}: {
  product: ShopifyProduct | null;
  isAuthenticated: boolean;
}) {
  const router = useRouter();
  const [selectedVariantId, setSelectedVariantId] = useState<number | null>(null);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [wishlisted, setWishlisted] = useState(false);
  const [compared, setCompared] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [activeSpecTab, setActiveSpecTab] = useState<SpecTab>("performance");

  const gallery = useMemo(() => {
    const images = product?.images?.filter((item) => item?.src) || [];
    if (images.length) return images;
    return [
      {
        src: "https://images.unsplash.com/photo-1498049860654-af1a5c566876?q=80&w=800&auto=format&fit=crop",
      },
    ];
  }, [product]);

  const variants = useMemo(() => {
    if (!product) return [];
    return resolveVariantsFromProduct(product);
  }, [product]);

  const selectedVariant: ResolvedVariant | null = useMemo(() => {
    if (!variants.length) return null;
    if (!selectedVariantId) return variants[0];
    return variants.find((variant) => variant.id === selectedVariantId) || variants[0];
  }, [variants, selectedVariantId]);

  const specEntries = useMemo(() => {
    if (!product) return [];

    const fromMeta = parseMetafieldSpecs(product.metafields);
    const fromTags = parseTagSpecs(product.tags);
    const fromDescription = parseDescriptionSpecs(product.description_html, product.description);
    const displayBrand = resolveDisplayBrand(product);

    const builtIn: SpecEntry[] = [
      displayBrand ? { label: "Brand", value: displayBrand } : null,
      { label: "Model", value: product.title },
      product.category || product.product_type
        ? { label: "Category", value: product.category || product.product_type || "" }
        : null,
    ].filter((entry): entry is SpecEntry => Boolean(entry));

    const ordered = [...fromMeta, ...fromTags, ...fromDescription, ...builtIn];
    const seen = new Set<string>();
    return ordered.filter((entry) => {
      const key = entry.label.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return Boolean(entry.value.trim());
    });
  }, [product]);

  const specTabs = useMemo(() => splitSpecTabs(specEntries), [specEntries]);
  const activeSpecEntries = useMemo(() => {
    if (activeSpecTab === "performance") return specTabs.performance;
    if (activeSpecTab === "software") return specTabs.software;
    return specTabs.moreInfo;
  }, [activeSpecTab, specTabs]);

  useEffect(() => {
    if (!product || typeof window === "undefined") return;
    const raw = localStorage.getItem("pcgs_wishlist_ids");
    const ids = raw ? (JSON.parse(raw) as number[]) : [];
    setWishlisted(Array.isArray(ids) ? ids.includes(product.id) : false);
    const compareRaw = localStorage.getItem("pcgs_compare_product_ids");
    const compareIds = compareRaw ? (JSON.parse(compareRaw) as number[]) : [];
    setCompared(Array.isArray(compareIds) ? compareIds.includes(product.id) : false);
  }, [product]);

  if (!product) {
    return (
      <section className="section">
        <div className="container">
          <p className="hero__subtext">Product not found.</p>
        </div>
      </section>
    );
  }

  const handleAddToCart = () => {
    setError("");
    if (!selectedVariant?.id) {
      setError("No valid variant found for this product.");
      return;
    }
    addCartItemToStorage({
      productId: product.id,
      title: product.title,
      variantId: selectedVariant.id,
      variantTitle: selectedVariant.title || "Default",
      quantity: 1,
      price: selectedVariant.price || "0",
    });
    router.push("/cart");
  };

  const handleBuyNow = () => {
    setError("");
    if (!selectedVariant?.id) {
      setError("No valid variant found for this product.");
      return;
    }
    if (!isAuthenticated) {
      const next = encodeURIComponent(
        `/checkout?productId=${product.id}&variantId=${selectedVariant.id}&qty=1`
      );
      router.push(`/login?next=${next}`);
      return;
    }
    router.push(`/checkout?productId=${product.id}&variantId=${selectedVariant.id}&qty=1`);
  };

  const toggleWishlist = () => {
    if (!product || typeof window === "undefined") return;
    const raw = localStorage.getItem("pcgs_wishlist_ids");
    const ids = raw ? (JSON.parse(raw) as number[]) : [];
    const safeIds = Array.isArray(ids) ? ids : [];
    const next = safeIds.includes(product.id)
      ? safeIds.filter((id) => id !== product.id)
      : [...safeIds, product.id];
    localStorage.setItem("pcgs_wishlist_ids", JSON.stringify(next));
    window.dispatchEvent(new Event("pcgs-wishlist-updated"));
    setWishlisted(next.includes(product.id));
    setInfo(next.includes(product.id) ? "Added to wishlist" : "Removed from wishlist");
  };

  const shareProduct = async () => {
    if (!product || typeof window === "undefined") return;
    const url = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({ title: product.title, url });
      } else {
        await navigator.clipboard.writeText(url);
      }
      setInfo("Product link shared.");
    } catch {
      setInfo("Unable to share right now.");
    }
  };

  const toggleCompare = () => {
    if (!product || typeof window === "undefined") return;
    const raw = localStorage.getItem("pcgs_compare_product_ids");
    const ids = raw ? (JSON.parse(raw) as number[]) : [];
    const safeIds = Array.isArray(ids) ? ids.filter((id) => Number.isFinite(id)) : [];

    if (!safeIds.includes(product.id) && safeIds.length >= 3) {
      setError("You can compare up to 3 products only.");
      return;
    }

    const next = safeIds.includes(product.id)
      ? safeIds.filter((id) => id !== product.id)
      : [...safeIds, product.id];

    localStorage.setItem("pcgs_compare_product_ids", JSON.stringify(next));
    setCompared(next.includes(product.id));
    setError("");
    setInfo(next.includes(product.id) ? "Added to compare." : "Removed from compare.");
  };

  return (
    <section className="section">
      <div className="container">
        <div className="product-detail">
          <div className="product-detail__image">
            <button
              type="button"
              className="product-detail__back-btn"
              onClick={() => {
                if (typeof window !== "undefined" && window.history.length > 1) {
                  router.back();
                  return;
                }
                router.push("/store");
              }}
            >
              ← Back
            </button>
            <div className="product-detail__thumbs">
              {gallery.map((image, index) => (
                <button
                  type="button"
                  key={`${image.src}-${index}`}
                  className={`product-detail__thumb ${index === selectedImageIndex ? "is-active" : ""}`}
                  onClick={() => setSelectedImageIndex(index)}
                >
                  <img src={image.src} alt={`${product.title} view ${index + 1}`} />
                </button>
              ))}
            </div>
            <img
              src={gallery[selectedImageIndex]?.src || gallery[0].src}
              alt={product.title}
            />
          </div>
          <div className="product-detail__content">
            <div className="product-detail__toolbar">
              <button className="ghost" type="button" onClick={toggleWishlist}>
                {wishlisted ? "♥ Wishlisted" : "♡ Wishlist"}
              </button>
              <button className="ghost" type="button" onClick={shareProduct}>
                ↗ Share
              </button>
            </div>
            <p className="eyebrow">Product Details</p>
            <h1>{product.title}</h1>
            <p>{product.category || product.product_type || "General"}</p>
            {product.description ? <p className="product__desc">{product.description}</p> : null}
            {specEntries.length ? (
              <section className="product-specs">
                <h2>Technical Specification</h2>
                <div className="product-specs__tabs">
                  <button
                    type="button"
                    className={activeSpecTab === "performance" ? "is-active" : ""}
                    onClick={() => setActiveSpecTab("performance")}
                  >
                    Performance
                  </button>
                  <button
                    type="button"
                    className={activeSpecTab === "software" ? "is-active" : ""}
                    onClick={() => setActiveSpecTab("software")}
                  >
                    Software
                  </button>
                  <button
                    type="button"
                    className={activeSpecTab === "moreInfo" ? "is-active" : ""}
                    onClick={() => setActiveSpecTab("moreInfo")}
                  >
                    More Info
                  </button>
                </div>
                <div className="product-specs__grid">
                  {activeSpecEntries.length ? (
                    activeSpecEntries.map((entry) => (
                      <div className="product-specs__row" key={`${activeSpecTab}-${entry.label}`}>
                        <span>{entry.label}</span>
                        <strong>{entry.value}</strong>
                      </div>
                    ))
                  ) : (
                    <p className="product-specs__empty">No {activeSpecTab} data available for this product.</p>
                  )}
                </div>
              </section>
            ) : null}
            <p>Inventory: {getProductStockQty(product)}</p>
            <p>Variants: {variants.length}</p>
            {variants.length ? (
              <label className="product-variant">
                <span>Select variant</span>
                <select
                  value={String(selectedVariant?.id || "")}
                  onChange={(event) => setSelectedVariantId(Number(event.target.value))}
                >
                  {variants.map((variant) => (
                    <option key={variant.id} value={variant.id}>
                      {variant.title || "Default"} - {formatPrice(variant.price)}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            <div className="price">
              <span>{formatPrice(selectedVariant?.price)}</span>
            </div>
            <div className="product__actions product-detail__actions">
              <button className="secondary" type="button" onClick={handleAddToCart}>
                Add to Cart
              </button>
              <button className="primary" type="button" onClick={handleBuyNow}>
                Buy It Now
              </button>
              <button
                className={compared ? "product-action-btn product-action-btn--selected" : "product-action-btn product-action-btn--compare"}
                type="button"
                onClick={toggleCompare}
              >
                {compared ? "Compared" : "Compare"}
              </button>
              {compared ? (
                <button
                  className="product-action-btn product-action-btn--quick"
                  type="button"
                  onClick={() => router.push("/compare")}
                >
                  View Compare
                </button>
              ) : null}
            </div>
            {error ? <div className="admin__alert admin__alert--error">{error}</div> : null}
            {info ? <div className="admin__alert admin__alert--info">{info}</div> : null}
          </div>
        </div>
      </div>
    </section>
  );
}

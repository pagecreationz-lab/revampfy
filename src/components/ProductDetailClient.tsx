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

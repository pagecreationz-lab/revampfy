"use client";

import { useEffect, useMemo, useState } from "react";
import type { ShopifyProduct } from "@/lib/shopify";

const WISHLIST_KEY = "pcgs_wishlist_ids";

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

function getWishlistIds() {
  if (typeof window === "undefined") return [] as number[];
  try {
    const raw = localStorage.getItem(WISHLIST_KEY) || "[]";
    const parsed = JSON.parse(raw) as number[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function WishlistClient() {
  const [allProducts, setAllProducts] = useState<ShopifyProduct[]>([]);
  const [wishlistIds, setWishlistIds] = useState<number[]>([]);

  useEffect(() => {
    setWishlistIds(getWishlistIds());
    const load = async () => {
      const res = await fetch("/api/shopify/sync");
      const json = await res.json();
      setAllProducts(json?.payload?.products || []);
    };
    void load();
  }, []);

  const products = useMemo(
    () => allProducts.filter((product) => wishlistIds.includes(product.id)),
    [allProducts, wishlistIds]
  );

  const remove = (id: number) => {
    const next = wishlistIds.filter((item) => item !== id);
    setWishlistIds(next);
    localStorage.setItem(WISHLIST_KEY, JSON.stringify(next));
    window.dispatchEvent(new Event("pcgs-wishlist-updated"));
  };

  return (
    <section className="section">
      <div className="container">
        <div className="admin">
          <h1>My Wishlist</h1>
          <p className="hero__subtext">Saved products for later.</p>
          <div className="wishlist-grid">
            {products.length ? (
              products.map((product) => (
                <article className="product" key={product.id}>
                  <img
                    src={
                      product.images?.[0]?.src ||
                      "https://images.unsplash.com/photo-1498049860654-af1a5c566876?q=80&w=800&auto=format&fit=crop"
                    }
                    alt={product.title}
                  />
                  <h3>{product.title}</h3>
                  <p>{product.category || product.product_type || "General"}</p>
                  <div className="price">
                    <span>{formatPrice(product.variants?.[0]?.price)}</span>
                  </div>
                  <div className="product__actions">
                    <a href={`/store/${product.id}`}>
                      <button className="secondary" type="button">Open</button>
                    </a>
                    <button className="ghost" type="button" onClick={() => remove(product.id)}>
                      Remove
                    </button>
                  </div>
                </article>
              ))
            ) : (
              <p className="hero__subtext">No wishlist items yet.</p>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

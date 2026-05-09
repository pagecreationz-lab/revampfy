"use client";

import { useEffect, useMemo, useState } from "react";
import type { CatalogProduct } from "@/lib/catalog";
import { readJsonSafe } from "@/lib/httpClient";

const COMPARE_KEY = "pcgs_compare_product_ids";

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

function getCompareIds(): string[] {
  try {
    const raw = localStorage.getItem(COMPARE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown[];
    return Array.isArray(parsed) ? parsed.map((id) => String(id)).filter(Boolean).slice(0, 3) : [];
  } catch {
    return [];
  }
}

function saveCompareIds(ids: string[]) {
  localStorage.setItem(COMPARE_KEY, JSON.stringify(ids.slice(0, 3)));
}

function getCategoryLabel(product: CatalogProduct) {
  return (product.category || product.product_type || "General").trim();
}

export function CompareClient() {
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [ids, setIds] = useState<string[]>([]);
  const [compareError, setCompareError] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [showCategoryWarning, setShowCategoryWarning] = useState(false);

  useEffect(() => {
    const initialIds = getCompareIds();
    setIds(initialIds);
    saveCompareIds(initialIds);
    const load = async () => {
      const res = await fetch("/api/catalog/products?limit=250");
      const json = await readJsonSafe(res);
      setProducts(json?.products || []);
    };
    void load();
  }, []);

  const comparedProducts = useMemo(
    () => products.filter((product) => ids.includes(String(product.id))),
    [products, ids]
  );

  const compareCategory = useMemo(
    () => (comparedProducts[0] ? getCategoryLabel(comparedProducts[0]).toLowerCase() : ""),
    [comparedProducts]
  );

  const categoryOptions = useMemo(
    () =>
      Array.from(new Set(products.map((product) => getCategoryLabel(product)).filter(Boolean))).sort(
        (a, b) => a.localeCompare(b)
      ),
    [products]
  );

  useEffect(() => {
    if (compareCategory) {
      setSelectedCategory(compareCategory);
    } else if (selectedCategory !== "all" && categoryOptions.length) {
      const stillExists = categoryOptions.some(
        (category) => category.toLowerCase() === selectedCategory
      );
      if (!stillExists) setSelectedCategory("all");
    }
  }, [compareCategory, categoryOptions, selectedCategory]);

  const suggestionProducts = useMemo(
    () =>
      products
        .filter((product) => {
          if (ids.includes(String(product.id))) return false;
          const productCategory = getCategoryLabel(product).toLowerCase();
          if (compareCategory) return productCategory === compareCategory;
          if (selectedCategory === "all") return true;
          return productCategory === selectedCategory;
        })
        .slice(0, 8),
    [products, ids, compareCategory, selectedCategory]
  );

  const canCompare = comparedProducts.length >= 2;

  const removeFromCompare = (productId: string) => {
    const next = ids.filter((id) => id !== productId);
    setIds(next);
    saveCompareIds(next);
    setCompareError("");
  };

  const addToCompare = (productId: string) => {
    if (ids.includes(productId) || ids.length >= 3) return;
    const product = products.find((item) => String(item.id) === productId);
    if (!product) return;
    const nextCategory = getCategoryLabel(product).toLowerCase();
    if (compareCategory && compareCategory !== nextCategory) {
      setCompareError("Only same category products can be compared together.");
      return;
    }
    const next = [...ids, productId];
    setIds(next);
    saveCompareIds(next);
    setCompareError("");
  };

  const handleCategoryChange = (value: string) => {
    const normalized = value.toLowerCase();
    if (compareCategory && normalized !== compareCategory) {
      setShowCategoryWarning(true);
      return;
    }
    setSelectedCategory(normalized);
  };

  return (
    <section className="section">
      <div className="container">
        <div className="admin">
          <h1>Compare Products</h1>
          <p className="hero__subtext">
            Choose up to 3 products. Add at least 2 items to compare.
          </p>
          <div className="compare-topbar">
            <span className="compare-pill">Selected: {comparedProducts.length}/3</span>
            {!canCompare ? (
              <span className="compare-warning">Add one more product to start comparison.</span>
            ) : (
              <span className="compare-ready">Comparison ready</span>
            )}
            {compareCategory ? (
              <span className="compare-pill">Category: {comparedProducts[0]?.category || comparedProducts[0]?.product_type || "General"}</span>
            ) : null}
            <label className="compare-category-picker">
              <span>Switch Category</span>
              <select
                value={selectedCategory}
                onChange={(event) => handleCategoryChange(event.target.value)}
              >
                <option value="all">All categories</option>
                {categoryOptions.map((category) => (
                  <option key={category} value={category.toLowerCase()}>
                    {category}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {compareError ? <p className="store-compare-notice">{compareError}</p> : null}

          <div className="product-grid store-products-grid compare-grid">
            {comparedProducts.length ? (
              comparedProducts.map((product, index) => (
                <article className="product" key={`${product.handle || product.id}-cmp-${index}`}>
                  <img
                    src={
                      product.images?.[0]?.src ||
                      "https://images.unsplash.com/photo-1498049860654-af1a5c566876?q=80&w=800&auto=format&fit=crop"
                    }
                    alt={product.title}
                  />
                  <h3>{product.title}</h3>
                  <p>{product.category || product.product_type || "General"}</p>
                  <p>Vendor: {product.vendor || "N/A"}</p>
                  <p>Variants: {product.variants?.length || 0}</p>
                  <div className="price">
                    <span>{formatPrice(product.variants?.[0]?.price)}</span>
                  </div>
                  <div className="product__actions">
                    <a href={`/store/${encodeURIComponent(product.handle || String(product.id))}`}>
                      <button className="secondary product-action-btn product-action-btn--quick">
                        Quick View
                      </button>
                    </a>
                    <button
                      className="product-action-btn product-action-btn--remove"
                      type="button"
                      onClick={() => removeFromCompare(String(product.id))}
                    >
                      Remove
                    </button>
                  </div>
                </article>
              ))
            ) : (
              <p className="hero__subtext">No products selected for compare yet.</p>
            )}
          </div>

          <div className="compare-suggestions">
            <h3>Suggested Products to Add</h3>
            <div className="product-grid store-products-grid compare-grid">
              {suggestionProducts.length ? (
                suggestionProducts.map((product, index) => (
                  <article className="product" key={`${product.handle || product.id}-sug-${index}`}>
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
                      <button
                        type="button"
                        className="product-action-btn product-action-btn--compare"
                        onClick={() => addToCompare(String(product.id))}
                        disabled={ids.length >= 3}
                      >
                        Add to Compare
                      </button>
                    </div>
                  </article>
                ))
              ) : (
                <p className="hero__subtext">No more products available for suggestions.</p>
              )}
            </div>
          </div>
        </div>
      </div>
      {showCategoryWarning ? (
        <div className="quick-view-modal" onClick={() => setShowCategoryWarning(false)}>
          <div className="quick-view-modal__card quick-view-modal__card--warning" onClick={(event) => event.stopPropagation()}>
            <h3>Category Mismatch</h3>
            <p className="hero__subtext">
              Please select products from the same category to compare.
            </p>
            <div className="product__actions">
              <button
                type="button"
                className="product-action-btn product-action-btn--compare"
                onClick={() => setShowCategoryWarning(false)}
              >
                OK
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}


"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { ShopifyCollection, ShopifyProduct } from "@/lib/shopify";
import {
  getPrimaryCategory,
  getProductPrices,
  getProductStockQty,
} from "@/lib/product";

type SortOption = "featured" | "priceAsc" | "priceDesc" | "nameAsc" | "nameDesc";

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function normalizeCollectionName(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .replace(/\b(laptops|laptop)\b/g, "laptop")
    .replace(/\b(refurbished|refirbished)\b/g, "refurbished")
    .trim();
}

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

function getDiscountPercent(product: ShopifyProduct) {
  const first = product.variants?.[0];
  const price = Number(first?.price || 0);
  const compare = Number(first?.compare_at_price || 0);
  if (!price || !compare || compare <= price) return null;
  return Math.round(((compare - price) / compare) * 100);
}

const COMPARE_KEY = "pcgs_compare_product_ids";
const WISHLIST_KEY = "pcgs_wishlist_ids";

function getProductCategoryLabel(product: ShopifyProduct) {
  return (product.category || product.product_type || "General").trim();
}

function getCompareIds(): number[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(COMPARE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as number[];
    return Array.isArray(parsed) ? parsed.filter((id) => Number.isFinite(id)) : [];
  } catch {
    return [];
  }
}

function toggleCompareId(productId: number) {
  const ids = getCompareIds();
  const next = ids.includes(productId)
    ? ids.filter((id) => id !== productId)
    : [...ids, productId];
  localStorage.setItem(COMPARE_KEY, JSON.stringify(next));
  return next;
}

function getWishlistIds(): number[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(WISHLIST_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as number[];
    return Array.isArray(parsed) ? parsed.filter((id) => Number.isFinite(id)) : [];
  } catch {
    return [];
  }
}

function toggleWishlistId(productId: number) {
  const ids = getWishlistIds();
  const next = ids.includes(productId)
    ? ids.filter((id) => id !== productId)
    : [...ids, productId];
  localStorage.setItem(WISHLIST_KEY, JSON.stringify(next));
  window.dispatchEvent(new Event("pcgs-wishlist-updated"));
  return next;
}

export function StoreClient({
  products,
  collections,
}: {
  products: ShopifyProduct[];
  collections: ShopifyCollection[];
}) {
  const searchParams = useSearchParams();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedProductType, setSelectedProductType] = useState("all");
  const [selectedVendor, setSelectedVendor] = useState("all");
  const [selectedTag, setSelectedTag] = useState("all");
  const [selectedCollection, setSelectedCollection] = useState("all");
  const [selectedAvailability, setSelectedAvailability] = useState("all");
  const [sortBy, setSortBy] = useState<SortOption>("featured");
  const [compareIds, setCompareIds] = useState<number[]>([]);
  const [wishlistIds, setWishlistIds] = useState<number[]>([]);
  const [compareNotice, setCompareNotice] = useState("");
  const [quickViewProduct, setQuickViewProduct] = useState<ShopifyProduct | null>(null);
  const [comparePreviewProduct, setComparePreviewProduct] = useState<ShopifyProduct | null>(null);
  const [showCompareCategoryWarning, setShowCompareCategoryWarning] = useState(false);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  useEffect(() => {
    setCompareIds(getCompareIds());
    setWishlistIds(getWishlistIds());
  }, []);

  const collectionOptions = useMemo(
    () =>
      collections
        .map((collection) => ({
          label: (collection.title || "").trim(),
          value: (collection.handle || "").trim(),
          slug: slugify(collection.title || ""),
          normalized: normalizeCollectionName(collection.title || ""),
        }))
        .filter((item) => item.label && item.value)
        .sort((a, b) => a.label.localeCompare(b.label)),
    [collections]
  );

  useEffect(() => {
    const query = (searchParams.get("q") || "").trim();
    if (query) {
      setSearchTerm(query);
    }
    const category = (searchParams.get("category") || "").trim();
    if (category) {
      setSelectedCategory(category);
    }
    const collection = (searchParams.get("collection") || "").trim();
    const collectionName = (searchParams.get("collectionName") || "").trim();
    if (collection) {
      const normalizedInput = normalizeCollectionName(collectionName || collection);
      const match = collectionOptions.find(
        (item) =>
          item.value === collection ||
          item.slug === collection ||
          item.normalized === normalizedInput
      );
      setSelectedCollection(match?.value || "all");
    } else if (collectionName) {
      const normalizedInput = normalizeCollectionName(collectionName);
      const match = collectionOptions.find((item) => item.normalized === normalizedInput);
      setSelectedCollection(match?.value || "all");
    }
  }, [searchParams, collectionOptions]);

  const allPrices = useMemo(
    () => products.flatMap((product) => getProductPrices(product)),
    [products]
  );
  const minPrice = useMemo(
    () => (allPrices.length ? Math.floor(Math.min(...allPrices)) : 0),
    [allPrices]
  );
  const maxPrice = useMemo(
    () => (allPrices.length ? Math.ceil(Math.max(...allPrices)) : 0),
    [allPrices]
  );
  const [priceMin, setPriceMin] = useState(minPrice);
  const [priceMax, setPriceMax] = useState(maxPrice);

  const categoryOptions = useMemo(
    () =>
      Array.from(new Set(products.map((product) => getPrimaryCategory(product)).filter(Boolean)))
        .sort((a, b) => a.localeCompare(b)),
    [products]
  );

  const productTypeOptions = useMemo(
    () =>
      Array.from(
        new Set(products.map((product) => (product.product_type || "").trim()).filter(Boolean))
      ).sort((a, b) => a.localeCompare(b)),
    [products]
  );

  const vendorOptions = useMemo(
    () =>
      Array.from(new Set(products.map((product) => (product.vendor || "").trim()).filter(Boolean)))
        .sort((a, b) => a.localeCompare(b)),
    [products]
  );

  const tagOptions = useMemo(
    () =>
      Array.from(
        new Set(
          products.flatMap((product) =>
            (product.tags || "")
              .split(",")
              .map((tag) => tag.trim())
              .filter(Boolean)
          )
        )
      ).sort((a, b) => a.localeCompare(b)),
    [products]
  );

  const filteredProducts = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    const minBound = Math.min(priceMin, priceMax);
    const maxBound = Math.max(priceMin, priceMax);

    const filtered = products.filter((product) => {
      const category = getPrimaryCategory(product);
      const productType = (product.product_type || "").trim();
      const vendor = (product.vendor || "").trim();
      const tags = (product.tags || "")
        .split(",")
        .map((tag) => tag.trim().toLowerCase())
        .filter(Boolean);
      const stockQty = getProductStockQty(product);
      const prices = getProductPrices(product);
      const basePrice = prices.length ? Math.min(...prices) : 0;
      const normalizedBlob = [
        product.title,
        product.handle,
        category,
        productType,
        vendor,
        product.tags || "",
      ]
        .join(" ")
        .toLowerCase();

      if (
        query &&
        !(
          product.title.toLowerCase().includes(query) ||
          product.handle.toLowerCase().includes(query) ||
          category.toLowerCase().includes(query) ||
          vendor.toLowerCase().includes(query) ||
          tags.some((tag) => tag.includes(query))
        )
      ) {
        return false;
      }

      if (selectedCategory !== "all" && category !== selectedCategory) return false;
      if (selectedProductType !== "all" && productType !== selectedProductType) return false;
      if (selectedVendor !== "all" && vendor !== selectedVendor) return false;
      if (selectedTag !== "all" && !tags.includes(selectedTag.toLowerCase())) return false;
      if (selectedCollection !== "all") {
        const selected = collectionOptions.find((item) => item.value === selectedCollection);
        const handleNeedle = selectedCollection.toLowerCase();
        const titleNeedle = (selected?.label || "").toLowerCase();
        const collectionHandles = (product.collection_handles || []).map((entry) =>
          entry.toLowerCase()
        );
        const collectionTitles = (product.collection_titles || []).map((entry) =>
          entry.toLowerCase()
        );
        const hasDirectCollectionMatch =
          collectionHandles.includes(handleNeedle) ||
          (titleNeedle ? collectionTitles.includes(titleNeedle) : false);
        const matchesCollection =
          hasDirectCollectionMatch ||
          normalizedBlob.includes(handleNeedle) ||
          (titleNeedle ? normalizedBlob.includes(titleNeedle) : false);
        if (!matchesCollection) return false;
      }
      if (selectedAvailability === "inStock" && stockQty <= 0) return false;
      if (selectedAvailability === "outOfStock" && stockQty > 0) return false;
      if (basePrice < minBound || basePrice > maxBound) return false;

      return true;
    });

    const sorted = [...filtered];
    if (sortBy === "priceAsc") {
      sorted.sort(
        (a, b) =>
          (getProductPrices(a).length ? Math.min(...getProductPrices(a)) : 0) -
          (getProductPrices(b).length ? Math.min(...getProductPrices(b)) : 0)
      );
    } else if (sortBy === "priceDesc") {
      sorted.sort(
        (a, b) =>
          (getProductPrices(b).length ? Math.min(...getProductPrices(b)) : 0) -
          (getProductPrices(a).length ? Math.min(...getProductPrices(a)) : 0)
      );
    } else if (sortBy === "nameAsc") {
      sorted.sort((a, b) => a.title.localeCompare(b.title));
    } else if (sortBy === "nameDesc") {
      sorted.sort((a, b) => b.title.localeCompare(a.title));
    }

    return sorted;
  }, [
    products,
    searchTerm,
    selectedCategory,
    selectedProductType,
    selectedVendor,
    selectedTag,
    selectedCollection,
    selectedAvailability,
    priceMin,
    priceMax,
    sortBy,
    collectionOptions,
  ]);

  const getStockStatus = (product: ShopifyProduct) => {
    const qty = getProductStockQty(product);
    if (qty <= 0) return { label: "Out of stock", className: "stock-badge stock-badge--out" };
    if (qty <= 5) return { label: "Low stock", className: "stock-badge stock-badge--low" };
    return { label: "In stock", className: "stock-badge stock-badge--in" };
  };

  return (
    <div className="store-shell">
      {mobileFiltersOpen ? (
        <button
          type="button"
          className="store-filters-backdrop"
          aria-label="Close filters"
          onClick={() => setMobileFiltersOpen(false)}
        />
      ) : null}
      <aside
        id="store-filters-panel"
        className={`store-filters store-filters--sidebar ${mobileFiltersOpen ? "is-open" : ""}`}
      >
        <div className="store-filters__header">
          <h3>Filters</h3>
          <button
            type="button"
            className="store-filters-close"
            onClick={() => setMobileFiltersOpen(false)}
          >
            Close
          </button>
        </div>
        <div className="store-filter-field store-filter-field--full">
          <label className="store-filter-label">
            <span className="store-filter-icon" aria-hidden>
              {"\u2315"}
            </span>
            Search
          </label>
          <input
            type="text"
            placeholder="Search products by name, brand, or tag"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
          />
        </div>
        <div className="store-filter-field">
          <label className="store-filter-label">
            <span className="store-filter-icon" aria-hidden>
              {"\u25A3"}
            </span>
            Category
          </label>
          <select value={selectedCategory} onChange={(event) => setSelectedCategory(event.target.value)}>
            <option value="all">All categories</option>
            {categoryOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>
        <div className="store-filter-field">
          <label className="store-filter-label">
            <span className="store-filter-icon" aria-hidden>
              {"\u2699"}
            </span>
            Brands
          </label>
          <select
            value={selectedProductType}
            onChange={(event) => setSelectedProductType(event.target.value)}
          >
            <option value="all">All Brands</option>
            {productTypeOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>
        <div className="store-filter-field">
          <label className="store-filter-label">
            <span className="store-filter-icon" aria-hidden>
              {"\u2302"}
            </span>
            Vendor
          </label>
          <select value={selectedVendor} onChange={(event) => setSelectedVendor(event.target.value)}>
            <option value="all">All vendors</option>
            {vendorOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>
        <div className="store-filter-field">
          <label className="store-filter-label">
            <span className="store-filter-icon" aria-hidden>
              {"\u0023"}
            </span>
            Tags
          </label>
          <select value={selectedTag} onChange={(event) => setSelectedTag(event.target.value)}>
            <option value="all">All tags</option>
            {tagOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>
        <div className="store-filter-field">
          <label className="store-filter-label">
            <span className="store-filter-icon" aria-hidden>
              {"\u25A7"}
            </span>
            Collection
          </label>
          <select
            value={selectedCollection}
            onChange={(event) => setSelectedCollection(event.target.value)}
          >
            <option value="all">All collections</option>
            {collectionOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <div className="store-filter-field">
          <label className="store-filter-label">
            <span className="store-filter-icon" aria-hidden>
              {"\u25CF"}
            </span>
            Availability
          </label>
          <select
            value={selectedAvailability}
            onChange={(event) => setSelectedAvailability(event.target.value)}
          >
            <option value="all">All availability</option>
            <option value="inStock">In stock</option>
            <option value="outOfStock">Out of stock</option>
          </select>
        </div>
        <div className="store-filter-field">
          <label className="store-filter-label">
            <span className="store-filter-icon" aria-hidden>
              {"\u21F5"}
            </span>
            Sort by
          </label>
          <select value={sortBy} onChange={(event) => setSortBy(event.target.value as SortOption)}>
            <option value="featured">Featured</option>
            <option value="priceAsc">Price: low to high</option>
            <option value="priceDesc">Price: high to low</option>
            <option value="nameAsc">Name: A to Z</option>
            <option value="nameDesc">Name: Z to A</option>
          </select>
        </div>
        <div className="store-filters__price">
          <label>
            Min
            <input
              type="number"
              value={priceMin}
              min={minPrice}
              max={priceMax}
              onChange={(event) => setPriceMin(Number(event.target.value || 0))}
            />
          </label>
          <label>
            Max
            <input
              type="number"
              value={priceMax}
              min={priceMin}
              max={maxPrice}
              onChange={(event) => setPriceMax(Number(event.target.value || 0))}
            />
          </label>
        </div>
        <button
          type="button"
          className="secondary"
          onClick={() => {
            setSearchTerm("");
            setSelectedCategory("all");
            setSelectedProductType("all");
            setSelectedVendor("all");
            setSelectedTag("all");
            setSelectedCollection("all");
            setSelectedAvailability("all");
            setSortBy("featured");
            setPriceMin(minPrice);
            setPriceMax(maxPrice);
          }}
        >
          Reset filters
        </button>
      </aside>

      <section>
        <div className="section__head">
          <div>
            <p className="eyebrow">Store</p>
            {compareNotice ? <p className="store-compare-notice">{compareNotice}</p> : null}
          </div>
          <button
            type="button"
            className="store-filters-toggle"
            onClick={() => setMobileFiltersOpen((current) => !current)}
            aria-expanded={mobileFiltersOpen}
            aria-controls="store-filters-panel"
          >
            {mobileFiltersOpen ? "Hide Filters" : "Show Filters"}
          </button>
        </div>

        <div className="product-grid store-products-grid store-products-grid--store">
          {filteredProducts.length ? (
            filteredProducts.map((product) => {
              const stock = getStockStatus(product);
              const price = getProductPrices(product)[0];
              const selected = compareIds.includes(product.id);
              const wishlisted = wishlistIds.includes(product.id);
              const discount = getDiscountPercent(product);
              return (
                <article className="product" key={product.id}>
                  <a href={`/store/${product.id}`} className="product__link-cover" aria-label={product.title} />
                  <span className={stock.className}>{stock.label}</span>
                  <span className="badge">{discount ? `${discount}% Off` : "Featured"}</span>
                  <img
                    src={
                      product.images?.[0]?.src ||
                      "https://images.unsplash.com/photo-1498049860654-af1a5c566876?q=80&w=800&auto=format&fit=crop"
                    }
                    alt={product.title}
                  />
                  <h3 title={product.title}>{product.title}</h3>
                  <p>{product.handle.replace(/-/g, " ")}</p>
                  <div className="price store-card__price-row">
                    <span>{formatPrice(String(price || 0))}</span>
                    <div className="store-card__price-actions">
                      {discount ? <small className="store-card__discount">{discount}% Off</small> : null}
                      <button
                        className={`store-card__wishlist ${wishlisted ? "store-card__wishlist--active" : ""}`}
                        type="button"
                        aria-label={wishlisted ? "Remove from wishlist" : "Add to wishlist"}
                        title={wishlisted ? "Remove from wishlist" : "Add to wishlist"}
                        onClick={() => {
                          const next = toggleWishlistId(product.id);
                          setWishlistIds(next);
                        }}
                      >
                        {wishlisted ? "\u2665" : "\u2661"}
                      </button>
                    </div>
                  </div>
                  <p className="product__hint">Click card to view variants</p>
                  <div className="product__actions">
                    <button
                      className="secondary product-action-btn product-action-btn--quick"
                      type="button"
                      onClick={() => setQuickViewProduct(product)}
                    >
                      Quick View
                    </button>
                    <button
                      className={`product-action-btn ${
                        selected ? "product-action-btn--selected" : "product-action-btn--compare"
                      }`}
                      type="button"
                      onClick={() => setComparePreviewProduct(product)}
                    >
                      {selected ? "Selected" : "Compare"}
                    </button>
                  </div>
                </article>
              );
            })
          ) : (
            <p className="hero__subtext">No products match the selected filters.</p>
          )}
        </div>

        {quickViewProduct ? (
          <div
            className="quick-view-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Quick view product details"
            onClick={() => setQuickViewProduct(null)}
          >
            <div
              className="quick-view-modal__card"
              onClick={(event) => event.stopPropagation()}
            >
              <button
                className="quick-view-modal__close"
                type="button"
                onClick={() => setQuickViewProduct(null)}
                aria-label="Close quick view"
              >
                ×
              </button>
              <img
                src={
                  quickViewProduct.images?.[0]?.src ||
                  "https://images.unsplash.com/photo-1498049860654-af1a5c566876?q=80&w=800&auto=format&fit=crop"
                }
                alt={quickViewProduct.title}
              />
              <div className="quick-view-modal__content">
                <h3>{quickViewProduct.title}</h3>
                <p>Variants: {quickViewProduct.variants?.length || 0}</p>
                <div className="price">
                  <span>{formatPrice(String(getProductPrices(quickViewProduct)[0] || 0))}</span>
                </div>
                <div className="product__actions">
                  <a href={`/store/${quickViewProduct.id}`}>
                    <button className="product-action-btn product-action-btn--compare" type="button">
                      Open Full Details
                    </button>
                  </a>
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {comparePreviewProduct ? (
          <div
            className="quick-view-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Compare product details"
            onClick={() => setComparePreviewProduct(null)}
          >
            <div
              className="quick-view-modal__card quick-view-modal__card--compare"
              onClick={(event) => event.stopPropagation()}
            >
              <button
                className="quick-view-modal__close"
                type="button"
                onClick={() => setComparePreviewProduct(null)}
                aria-label="Close compare preview"
              >
                ×
              </button>
              <img
                src={
                  comparePreviewProduct.images?.[0]?.src ||
                  "https://images.unsplash.com/photo-1498049860654-af1a5c566876?q=80&w=800&auto=format&fit=crop"
                }
                alt={comparePreviewProduct.title}
              />
              <div className="quick-view-modal__content">
                <h3>{comparePreviewProduct.title}</h3>
                <p>Variants: {comparePreviewProduct.variants?.length || 0}</p>
                <div className="price">
                  <span>{formatPrice(String(getProductPrices(comparePreviewProduct)[0] || 0))}</span>
                </div>
                <div className="product__actions">
                  <button
                    className={`product-action-btn ${
                      compareIds.includes(comparePreviewProduct.id)
                        ? "product-action-btn--remove"
                        : "product-action-btn--compare"
                    }`}
                    type="button"
                    onClick={() => {
                      const existing = getCompareIds();
                      const existingProducts = products.filter((entry) =>
                        existing.includes(entry.id)
                      );
                      const baseCategory = existingProducts[0]
                        ? getProductCategoryLabel(existingProducts[0]).toLowerCase()
                        : "";
                      const nextCategory = getProductCategoryLabel(
                        comparePreviewProduct
                      ).toLowerCase();
                      if (
                        !existing.includes(comparePreviewProduct.id) &&
                        existing.length >= 3
                      ) {
                        setCompareNotice("You can compare up to 3 products only.");
                        return;
                      }
                      if (
                        !existing.includes(comparePreviewProduct.id) &&
                        baseCategory &&
                        baseCategory !== nextCategory
                      ) {
                        setShowCompareCategoryWarning(true);
                        return;
                      }
                      const next = toggleCompareId(comparePreviewProduct.id);
                      setCompareIds(next);
                      setCompareNotice("");
                    }}
                  >
                    {compareIds.includes(comparePreviewProduct.id)
                      ? "Remove from Compare"
                      : "Add to Compare"}
                  </button>
                  <a href="/compare">
                    <button className="product-action-btn product-action-btn--quick" type="button">
                      Open Compare Page
                    </button>
                  </a>
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {showCompareCategoryWarning ? (
          <div
            className="quick-view-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Compare category warning"
            onClick={() => setShowCompareCategoryWarning(false)}
          >
            <div
              className="quick-view-modal__card quick-view-modal__card--warning"
              onClick={(event) => event.stopPropagation()}
            >
              <h3>Category Mismatch</h3>
              <p className="hero__subtext">
                Please select products from the same category to compare.
              </p>
              <div className="product__actions">
                <button
                  type="button"
                  className="product-action-btn product-action-btn--compare"
                  onClick={() => setShowCompareCategoryWarning(false)}
                >
                  OK
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
}

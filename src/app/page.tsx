import { Header } from "@/components/Header";
import { Topbar } from "@/components/Topbar";
import { CountUpStat } from "@/components/CountUpStat";
import {
  getCollections,
  getProducts,
  stripHtml,
  type ShopifyCollection,
  type ShopifyProduct,
} from "@/lib/shopify";
import { getHomepageConfig } from "@/lib/homepage";
import { getSiteContent } from "@/lib/siteContent";
import { getEffectiveShopifySyncStore } from "@/lib/shopifySyncRuntime";

export const dynamic = "force-dynamic";

const fallbackCollections: ShopifyCollection[] = [
  {
    id: 1,
    title: "Laptops",
    handle: "laptops",
    body_html: "Lenovo, HP, Dell, Microsoft",
  },
  {
    id: 2,
    title: "Desktops",
    handle: "desktops",
    body_html: "Business & creator setups",
  },
  { id: 3, title: "Mini PC", handle: "mini-pc", body_html: "Compact powerhouses" },
  { id: 4, title: "Monitors", handle: "monitors", body_html: "Full HD & 4K panels" },
  { id: 5, title: "Gaming", handle: "gaming", body_html: "High-performance GPUs" },
  { id: 6, title: "MacBook", handle: "macbook", body_html: "Premium Apple devices" },
];

const fallbackProducts: ShopifyProduct[] = [
  {
    id: 101,
    title: "MacBook Pro 13\" (2019)",
    handle: "macbook-pro-13-2019",
    images: [
      {
        src: "https://images.unsplash.com/photo-1517336714731-489689fd1ca8?q=80&w=800&auto=format&fit=crop",
      },
    ],
    variants: [{ price: "38999", compare_at_price: "67999" }],
  },
  {
    id: 102,
    title: "Lenovo ThinkPad T480",
    handle: "lenovo-thinkpad-t480",
    images: [
      {
        src: "https://images.unsplash.com/photo-1518770660439-4636190af475?q=80&w=800&auto=format&fit=crop",
      },
    ],
    variants: [{ price: "29999", compare_at_price: "48499" }],
  },
  {
    id: 103,
    title: "Dell OptiPlex 7080",
    handle: "dell-optiplex-7080",
    images: [
      {
        src: "https://images.unsplash.com/photo-1519389950473-47ba0277781c?q=80&w=800&auto=format&fit=crop",
      },
    ],
    variants: [{ price: "24499", compare_at_price: "37999" }],
  },
  {
    id: 104,
    title: "HP ZBook 15 G5",
    handle: "hp-zbook-15-g5",
    images: [
      {
        src: "https://images.unsplash.com/photo-1517059224940-d4af9eec41f7?q=80&w=800&auto=format&fit=crop",
      },
    ],
    variants: [{ price: "44999", compare_at_price: "81999" }],
  },
];

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

function getDiscountLabel(product: ShopifyProduct) {
  const variant = product.variants?.[0];
  const price = Number(variant?.price);
  const compare = Number(variant?.compare_at_price);
  if (!variant || Number.isNaN(price) || Number.isNaN(compare) || !compare) {
    return "Featured";
  }
  const percent = Math.round(((compare - price) / compare) * 100);
  if (percent <= 0) return "Featured";
  return `-${percent}%`;
}

function getStockStatus(product: ShopifyProduct) {
  const qty =
    product.variants?.reduce(
      (sum, variant) => sum + Number(variant.inventory_quantity || 0),
      0
    ) || 0;
  if (qty <= 0) return { label: "Out of stock", className: "stock-badge stock-badge--out" };
  if (qty <= 5) return { label: "Low stock", className: "stock-badge stock-badge--low" };
  return { label: "In stock", className: "stock-badge stock-badge--in" };
}

function getCollectionSubtitle(collection: ShopifyCollection) {
  const text = stripHtml(collection.body_html).trim();
  if (!text) return "Explore collection";
  if (text.toLowerCase() === "shop now") return "Explore collection";
  return text;
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function getCollectionHref(collection: ShopifyCollection) {
  return `/store?collection=${encodeURIComponent(slugify(collection.title))}`;
}

export default async function Home() {
  const [config, siteContent] = await Promise.all([
    getHomepageConfig(),
    getSiteContent(),
  ]);

  let collections: ShopifyCollection[] = [];
  let products: ShopifyProduct[] = [];
  let syncedPayload:
    | {
        categories: ShopifyCollection[];
        products: ShopifyProduct[];
      }
    | null = null;

  try {
    const synced = await getEffectiveShopifySyncStore();
    syncedPayload = {
      categories: synced.payload.categories,
      products: synced.payload.products,
    };
  } catch {
    syncedPayload = null;
  }

  if (syncedPayload?.categories?.length) {
    collections = syncedPayload.categories;
  } else {
    try {
      collections = await getCollections();
    } catch {
      collections = fallbackCollections;
    }
  }

  if (syncedPayload?.products?.length) {
    products = syncedPayload.products;
  } else {
    try {
      const response = await getProducts({ limit: 50 });
      products = response.products;
    } catch {
      products = fallbackProducts;
    }
  }

  const selectedCollections = collections.filter((collection) =>
    config.categoryCollectionHandles.includes(collection.handle)
  );

  const categories = selectedCollections;

  const selectedProducts = products.filter((product) =>
    config.topSellingProductIds.includes(product.id)
  );

  const topSellingBase = selectedProducts.length
    ? selectedProducts
    : products.length
      ? products.slice(0, 4)
      : fallbackProducts;

  const topSellingIds = new Set(topSellingBase.map((product) => product.id));
  const extraLatest = products.filter((product) => !topSellingIds.has(product.id)).slice(0, 4);
  const topSelling = [...topSellingBase, ...extraLatest].slice(0, 4);
  const homeHero =
    siteContent.pageBuilder?.homePage?.find((block) => block.type === "hero") ||
    siteContent.pageBuilder?.homePage?.[0];

  return (
    <>
      <Topbar />

      <Header />

      <main>
        <section className="hero">
          <div className="container hero__inner">
            <div className="hero__content">
              <p className="eyebrow">{homeHero?.eyebrow || "Revampfy"}</p>
              <h1>{siteContent.home.title || homeHero?.title}</h1>
              <p className="hero__subtext">{siteContent.home.subtitle || homeHero?.content}</p>
              <div className="hero__cta">
                <a href={homeHero?.ctaHref || "/#deals"}>
                  <button className="primary hero__shop-btn">{homeHero?.ctaLabel || "Shop Deals"}</button>
                </a>
                <a href="/#categories">
                  <button className="secondary">Browse Categories</button>
                </a>
              </div>
              <div className="chips">
                <span>refurbished laptop</span>
                <span>refurbished desktop</span>
                <span>Intel i7</span>
                <span>AMD Ryzen</span>
                <span>Gaming</span>
              </div>
            </div>
            <div className="hero__visual">
              <div className="hero__card">
                <img
                  src={
                    siteContent.home.heroImageUrl ||
                    "https://images.unsplash.com/photo-1498050108023-c5249f4df085?q=80&w=900&auto=format&fit=crop"
                  }
                  alt="Laptop"
                />
              </div>
              <div className="hero__stat">
              <h4>1,800+</h4>
              <p>Devices deployed since 2024</p>
              </div>
              <div className="hero__stat">
                <h4>96%</h4>
                <p>Quality pass rate</p>
              </div>
            </div>
          </div>
        </section>

        <section id="categories" className="section">
          <div className="container">
            <div className="section__head">
              <div>
                <p className="eyebrow">Featured Collections</p>
                <h2>Curated collections for quick shopping</h2>
              </div>
              <a href="/store">
                <button className="ghost">See all in Store</button>
              </a>
            </div>
            <div className="category-grid">
              {categories.length ? (
                categories.map((collection, index) => (
                  <a
                    key={collection.id}
                    href={getCollectionHref(collection)}
                    className={`category category--collection ${
                      index === categories.length - 1 ? "highlight" : ""
                    }`}
                  >
                    <h3>{collection.title}</h3>
                    <p>{getCollectionSubtitle(collection)}</p>
                    <p className="category__cta">Shop now</p>
                  </a>
                ))
              ) : (
                <p className="hero__subtext">
                  No featured collections selected yet. Configure featured collections in CMS Admin.
                </p>
              )}
            </div>
          </div>
        </section>

        <section id="deals" className="section section--alt">
          <div className="container">
            <div className="section__head">
              <div>
                <p className="eyebrow">Top Selling</p>
                <h2>Best value picks this week</h2>
              </div>
              <a href="/store">
                <button className="ghost">View all deals</button>
              </a>
            </div>
            <div className="product-grid">
              {topSelling.map((product) => (
                <a
                  className="product product--link-card"
                  key={product.id}
                  href={`/store/${product.id}`}
                >
                  <span className={getStockStatus(product).className}>
                    {getStockStatus(product).label}
                  </span>
                  <span className="badge">{getDiscountLabel(product)}</span>
                  <img
                    src={
                      product.images?.[0]?.src ||
                      "https://images.unsplash.com/photo-1498049860654-af1a5c566876?q=80&w=800&auto=format&fit=crop"
                    }
                    alt={product.title}
                  />
                  <h3>{product.title}</h3>
                  <p>{product.handle.replace(/-/g, " ")}</p>
                  <div className="price">
                    <span>{formatPrice(product.variants?.[0]?.price)}</span>
                    {product.variants?.[0]?.compare_at_price && (
                      <small>{formatPrice(product.variants?.[0]?.compare_at_price || "")}</small>
                    )}
                  </div>
                  <p className="product__hint">Click card to view variants</p>
                </a>
              ))}
            </div>
          </div>
        </section>

        <section className="section" id="usage">
          <div className="container">
            <div className="section__head">
              <div>
                <p className="eyebrow">Find by Usage</p>
                <h2>Devices tailored to your workflow</h2>
              </div>
            </div>
            <div className="usage-grid">
              <div className="usage">
                <h3>Accounting</h3>
                <p>Reliable, secure systems for finance teams.</p>
              </div>
              <div className="usage">
                <h3>Coding & Data</h3>
                <p>Multi-core power with high RAM options.</p>
              </div>
              <div className="usage">
                <h3>Video & Design</h3>
                <p>Color-accurate screens and GPU-ready rigs.</p>
              </div>
              <div className="usage">
                <h3>Education</h3>
                <p>Budget-friendly devices for students.</p>
              </div>
            </div>
          </div>
        </section>

        <section className="section section--alt" id="programs">
          <div className="container program">
            <div>
              <p className="eyebrow">Students & Partners</p>
              <h2>Dream On: build your tech journey</h2>
              <p>
                Access exclusive student discounts, campus ambassador opportunities, and
                bulk order support for institutions and startups.
              </p>
              <div className="program__cta">
                <a href="/store?q=student">
                  <button className="primary">For Students</button>
                </a>
                <a href="/partners">
                  <button className="secondary">Become Partner</button>
                </a>
              </div>
            </div>
            <div className="program__stats-wrap">
              <div className="program__stats">
                <div>
                  <CountUpStat target={5} suffix="+" />
                  <p>Partner campuses</p>
                </div>
                <div>
                  <CountUpStat target={120} suffix="+" />
                  <p>Bulk orders delivered</p>
                </div>
                <div>
                  <CountUpStat target={4.8} decimals={1} suffix="★" />
                  <p>Customer rating</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="section" id="trust">
          <div className="container">
            <div className="section__head">
              <div>
                <p className="eyebrow">Why Revampfy</p>
                <h2>Quality you can trust</h2>
              </div>
            </div>
            <div className="trust-grid">
              <article>
                <h3>Certified Refurbishment</h3>
                <p>40-point diagnostics with certified components and performance checks.</p>
              </article>
              <article>
                <h3>Warranty Included</h3>
                <p>Up to 12 months warranty with easy returns and support.</p>
              </article>
              <article>
                <h3>Fast Delivery</h3>
                <p>48-hour dispatch for major cities with live tracking.</p>
              </article>
            </div>
          </div>
        </section>

        <section className="section section--alt" id="bulk">
          <div className="container bulk">
            <div>
              <h2>Need 10+ devices?</h2>
              <p>We manage bulk deployments for businesses, schools, and NGOs.</p>
            </div>
            <a href="/bulk-orders-enquiry">
              <button className="primary">Get Bulk Quote</button>
            </a>
          </div>
        </section>

      </main>

      <footer className="footer" id="company">
        <div className="container footer__grid">
          <div>
            <div className="logo">Revampfy</div>
            <p>Refurbished laptops, desktops, and accessories with warranty.</p>
          </div>
          <div className="footer__nav-block">
            <h4>Quick Links</h4>
            <div className="footer__nav-links">
              <a href="/">Home</a>
              <a href="/#categories">All Categories</a>
              <a href="/store">Collections</a>
              <a href="/contact-us">Businesses</a>
              <a href="/bulk-orders-enquiry">Bulk Orders</a>
              <a href="/company">Company</a>
              <a href="/store">Store</a>
            </div>
          </div>
          <div>
            <h4>Company</h4>
            <p>{siteContent.aboutUs}</p>
          </div>
          <div>
            <h4>Contact Us</h4>
            <p>
              <a href="mailto:support@revampfy.in">support@revampfy.in</a>
            </p>
            <p>
              <a href="tel:+918248003564">+91 8248003564</a>
            </p>
          </div>
          <div>
            <h4>Partners</h4>
            <p>{siteContent.partners}</p>
            <h4 style={{ marginTop: "1rem" }}>Store Locator</h4>
            <p>{siteContent.storeLocator}</p>
          </div>
        </div>
        <div className="footer__bottom">
          <div className="container">
            <span>© 2026 Revampfy. All rights reserved.</span>
          </div>
        </div>
      </footer>
    </>
  );
}

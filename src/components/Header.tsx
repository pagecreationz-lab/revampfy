"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import { readJsonSafe } from "@/lib/httpClient";

type HeaderConfig = {
  categoryCollectionHandles: string[];
  featuredBrands: string[];
  featuredVendors: string[];
  studentsProductIds: number[];
};

type Collection = {
  id: number;
  title: string;
  handle: string;
  body_html?: string | null;
};

type Product = {
  id: number;
  title: string;
  handle: string;
  category?: string;
  product_type?: string;
  vendor?: string;
  tags?: string;
  collection_handles?: string[];
  collection_titles?: string[];
};

const defaultConfig: HeaderConfig = {
  categoryCollectionHandles: [],
  featuredBrands: [],
  featuredVendors: [],
  studentsProductIds: [],
};

const companyPaths = new Set([
  "/company",
  "/about-us",
  "/partners",
  "/stores",
  "/policies",
]);

const THEME_STORAGE_KEY = "pcgs_theme_mode";

function applyThemeToDocument(mode: "dark" | "light") {
  if (typeof document === "undefined") return;
  document.body.classList.remove("theme-dark", "theme-light");
  document.body.classList.add(mode === "light" ? "theme-light" : "theme-dark");
}

function ThemeIcon({ mode }: { mode: "dark" | "light" }) {
  if (mode === "dark") {
    return (
      <svg className="header-icon-svg" viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v3" />
        <path d="M12 19v3" />
        <path d="m4.93 4.93 2.12 2.12" />
        <path d="m16.95 16.95 2.12 2.12" />
        <path d="M2 12h3" />
        <path d="M19 12h3" />
        <path d="m4.93 19.07 2.12-2.12" />
        <path d="m16.95 7.05 2.12-2.12" />
      </svg>
    );
  }

  return (
    <svg className="header-icon-svg" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M20.35 15.35A9 9 0 0 1 8.65 3.65a9 9 0 1 0 11.7 11.7Z" />
    </svg>
  );
}

export function Header() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [mobileDropdowns, setMobileDropdowns] = useState({
    categories: false,
    collections: false,
    company: false,
  });
  const [activeMega, setActiveMega] = useState<
    "categories" | "students" | "company" | null
  >(null);
  const pathname = usePathname();
  const [config, setConfig] = useState<HeaderConfig>(defaultConfig);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [authenticated, setAuthenticated] = useState(false);
  const [sessionRole, setSessionRole] = useState<"admin" | "customer" | null>(null);
  const [cartCount, setCartCount] = useState(0);
  const [wishlistCount, setWishlistCount] = useState(0);
  const [searchTerm, setSearchTerm] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [themeMode, setThemeMode] = useState<"dark" | "light">("dark");
  const [megaLeft, setMegaLeft] = useState(0);
  const navRef = useRef<HTMLElement | null>(null);
  const closeTimerRef = useRef<number | null>(null);

  const clearCloseTimer = () => {
    if (closeTimerRef.current) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  };

  const scheduleCloseMega = () => {
    clearCloseTimer();
    closeTimerRef.current = window.setTimeout(() => {
      setActiveMega(null);
    }, 220);
  };

  const openMegaAtTrigger = (
    type: "categories" | "students" | "company",
    trigger: HTMLElement
  ) => {
    clearCloseTimer();
    setActiveMega(type);
    if (!navRef.current) return;
    const navRect = navRef.current.getBoundingClientRect();
    const triggerRect = trigger.getBoundingClientRect();
    const maxWidth = 780;
    const preferredLeft = triggerRect.left - navRect.left;
    const clampedLeft = Math.max(0, Math.min(preferredLeft, navRect.width - maxWidth));
    setMegaLeft(clampedLeft);
  };

  useEffect(() => {
    const loadHeaderData = async () => {
      try {
        const [configRes, syncRes, sessionRes] = await Promise.all([
          fetch("/api/admin/homepage"),
          fetch("/api/shopify/sync"),
          fetch("/api/auth/session"),
        ]);

        const configJson = await readJsonSafe(configRes);
        const syncJson = await readJsonSafe(syncRes);
        const sessionJson = await readJsonSafe(sessionRes);
        setConfig(configJson?.config || defaultConfig);
        setCollections(syncJson?.payload?.categories || []);
        setProducts(syncJson?.payload?.products || []);
        setAuthenticated(sessionRes.ok);
        setSessionRole(sessionJson?.session?.role || null);
      } catch {
        setConfig(defaultConfig);
        setAuthenticated(false);
        setSessionRole(null);
      }
    };

    loadHeaderData();
  }, []);

  useEffect(() => {
    return () => {
      if (closeTimerRef.current) {
        window.clearTimeout(closeTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") return;
    if (open) {
      document.body.style.overflow = "hidden";
      document.body.classList.add("mobile-menu-open");
      return;
    }
    document.body.style.overflow = "";
    document.body.classList.remove("mobile-menu-open");
  }, [open]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    setOpen(false);
    setMobileDropdowns({ categories: false, collections: false, company: false });
  }, [pathname]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const syncTheme = () => {
      const fromStorage = window.localStorage.getItem(THEME_STORAGE_KEY);
      const nextMode =
        fromStorage === "light" || fromStorage === "dark"
          ? fromStorage
          : document.body.classList.contains("theme-light")
            ? "light"
            : "dark";
      setThemeMode(nextMode);
      applyThemeToDocument(nextMode);
    };

    syncTheme();

    const onStorage = (event: StorageEvent) => {
      if (event.key !== THEME_STORAGE_KEY) return;
      syncTheme();
    };
    const onThemeUpdate = () => syncTheme();

    window.addEventListener("storage", onStorage);
    window.addEventListener("pcgs-theme-updated", onThemeUpdate);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("pcgs-theme-updated", onThemeUpdate);
    };
  }, []);

  useEffect(() => {
    const loadCounts = () => {
      if (typeof window === "undefined") return;
      const cartValue = Number(localStorage.getItem("pcgs_cart_count") || 0);
      const wishlistRaw = localStorage.getItem("pcgs_wishlist_ids") || "[]";
      let wishlistIds: number[] = [];
      try {
        const parsed = JSON.parse(wishlistRaw) as number[];
        wishlistIds = Array.isArray(parsed) ? parsed : [];
      } catch {
        wishlistIds = [];
      }
      setCartCount(Number.isFinite(cartValue) ? cartValue : 0);
      setWishlistCount(wishlistIds.length);
    };

    loadCounts();
    window.addEventListener("storage", loadCounts);
    window.addEventListener("pcgs-cart-updated", loadCounts);
    window.addEventListener("pcgs-wishlist-updated", loadCounts);
    return () => {
      window.removeEventListener("storage", loadCounts);
      window.removeEventListener("pcgs-cart-updated", loadCounts);
      window.removeEventListener("pcgs-wishlist-updated", loadCounts);
    };
  }, []);

  const uploadedCategories = useMemo(() => {
    return collections;
  }, [collections]);

  const categoryMenuItems = useMemo(() => {
    const fromProducts = Array.from(
      new Set(
        products
          .map((product) => (product.category || product.product_type || "").trim())
          .filter(Boolean)
      )
    ).sort((a, b) => a.localeCompare(b));

    if (fromProducts.length) return fromProducts;

    return Array.from(
      new Set(uploadedCategories.map((collection) => collection.title.trim()).filter(Boolean))
    ).sort((a, b) => a.localeCompare(b));
  }, [products, uploadedCategories]);

  const categoryMegaGroups = useMemo(() => {
    const norm = (value: string) => value.trim().toLowerCase();
    const getBrandLabel = (product: Product) => {
      const title = (product.title || "").trim();
      if (!title) return "Unknown";
      const first = title.split(/\s+/)[0] || "";
      return first.replace(/[^a-z0-9&-]/gi, "") || "Unknown";
    };
    return categoryMenuItems.map((category) => {
      const brands = Array.from(
        new Set(
          products
            .filter((product) => norm(product.category || product.product_type || "") === norm(category))
            .map((product) => getBrandLabel(product))
            .filter(Boolean)
        )
      )
        .sort((a, b) => a.localeCompare(b))
        .slice(0, 12);

      const items = brands.map((brand, index) => ({
        id: index + 1,
        title: brand,
      }));

      return { category, items };
    });
  }, [categoryMenuItems, products]);

  const categoryMenuLinks = useMemo(() => {
    return categoryMegaGroups.map((group) => {
      const items = group.items.map((item) => ({
        ...item,
        href: `/store?category=${encodeURIComponent(group.category)}&q=${encodeURIComponent(
          item.title
        )}`,
      }));
      return { ...group, items };
    });
  }, [categoryMegaGroups]);

  const collectionMegaGroups = useMemo(() => {
    const normalize = (value: string) => value.trim().toLowerCase();
    return uploadedCategories
      .filter((collection) => (collection.title || "").trim())
      .map((collection) => {
        const items = products
          .filter((product) => {
            const handles = (product.collection_handles || []).map(normalize);
            const titles = (product.collection_titles || []).map(normalize);
            return (
              handles.includes(normalize(collection.handle || "")) ||
              titles.includes(normalize(collection.title || ""))
            );
          })
          .slice(0, 8)
          .map((product) => ({
            id: product.id,
            title: product.title,
            href: `/store/${product.id}`,
          }));

        return {
          id: collection.id,
          title: collection.title,
          href: `/store?collection=${encodeURIComponent(collection.handle)}`,
          items,
        };
      });
  }, [uploadedCategories, products]);

  const companyMegaGroups = useMemo(
    () => [
      {
        id: "company-info",
        title: "Company",
        handle: "",
        products: [
          { id: -1, title: "About Us", href: "/about-us" },
          { id: -2, title: "Partners", href: "/partners" },
          { id: -3, title: "Stores", href: "/stores" },
          { id: -4, title: "Contact Us", href: "/contact-us" },
          { id: -5, title: "Policies", href: "/policies" },
          { id: -6, title: "View More", href: "/company" },
        ],
      },
    ],
    []
  );

  const isCompanyActive = companyPaths.has(pathname);
  const accountHref = authenticated
    ? sessionRole === "admin"
      ? "/admin"
      : "/user-dashboard"
    : "/login";
  const accountLabel = authenticated
    ? sessionRole === "admin"
      ? "Admin"
      : "My Account"
    : "Login";
  const productSuggestions = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) return [];
    return products
      .filter(
        (product) =>
          product.title.toLowerCase().includes(query) ||
          product.handle.toLowerCase().includes(query)
      )
      .slice(0, 6);
  }, [products, searchTerm]);

  const runSearch = (term?: string) => {
    const value = (term ?? searchTerm).trim();
    if (!value) return;
    setSearchOpen(false);
    router.push(`/store?q=${encodeURIComponent(value)}`);
  };

  const toggleThemeMode = () => {
    const nextMode = themeMode === "dark" ? "light" : "dark";
    setThemeMode(nextMode);
    applyThemeToDocument(nextMode);
    try {
      if (typeof window !== "undefined") {
        window.localStorage.setItem(THEME_STORAGE_KEY, nextMode);
        window.dispatchEvent(new Event("pcgs-theme-updated"));
      }
    } catch {
      // Keep local switch even if browser storage is unavailable.
    }
  };

  const mobileMenuOverlay = (
    <div className={`mobile-nav-drawer ${open ? "active" : ""}`.trim()}>
      <div className="mobile-nav-sheet">
        <div className="mobile-nav-top">
          <button
            type="button"
            className="nav__toggle mobile-nav-close-toggle is-close"
            aria-label="Close menu"
            onClick={() => setOpen(false)}
          >
            <span />
            <span />
            <span />
          </button>
          <span className="mobile-nav-title">Menu</span>
        </div>

        <div className="mobile-nav-content">
          <div className="mobile-nav-list">
            <a href="/" onClick={() => setOpen(false)}>Home</a>
            <div className="mobile-nav-item">
              <button
                type="button"
                className="mobile-nav-trigger"
                onClick={() =>
                  setMobileDropdowns((prev) => ({
                    ...prev,
                    categories: !prev.categories,
                  }))
                }
              >
                <span>All Categories</span>
                <span className={`mobile-nav-caret ${mobileDropdowns.categories ? "is-open" : ""}`} />
              </button>
              {mobileDropdowns.categories ? (
                <div className="mobile-nav-submenu">
                  <a href="/store" onClick={() => setOpen(false)}>View all categories</a>
                  {categoryMenuLinks.length ? (
                    categoryMenuLinks.map((group) => (
                      <a
                        key={`mobile-category-${group.category}`}
                        href={`/store?category=${encodeURIComponent(group.category)}`}
                        onClick={() => setOpen(false)}
                      >
                        {group.category}
                      </a>
                    ))
                  ) : (
                    <span className="mobile-nav-empty">No synced categories yet.</span>
                  )}
                </div>
              ) : null}
            </div>
            <div className="mobile-nav-item">
              <button
                type="button"
                className="mobile-nav-trigger"
                onClick={() =>
                  setMobileDropdowns((prev) => ({
                    ...prev,
                    collections: !prev.collections,
                  }))
                }
              >
                <span>Collections</span>
                <span className={`mobile-nav-caret ${mobileDropdowns.collections ? "is-open" : ""}`} />
              </button>
              {mobileDropdowns.collections ? (
                <div className="mobile-nav-submenu">
                  <a href="/store" onClick={() => setOpen(false)}>View all collections</a>
                  {collectionMegaGroups.length ? (
                    collectionMegaGroups.map((group) => (
                      <a
                        key={`mobile-collection-${group.id}`}
                        href={group.href}
                        onClick={() => setOpen(false)}
                      >
                        {group.title}
                      </a>
                    ))
                  ) : (
                    <span className="mobile-nav-empty">No collections synced yet.</span>
                  )}
                </div>
              ) : null}
            </div>
            <a href={accountHref} onClick={() => setOpen(false)}>{accountLabel}</a>
            <a href="/contact-us" onClick={() => setOpen(false)}>Businesses</a>
            <a href="/bulk-orders-enquiry" onClick={() => setOpen(false)}>Bulk Orders</a>
            <a href="/company" onClick={() => setOpen(false)}>Company</a>
            <a href="/about-us" onClick={() => setOpen(false)}>About Us</a>
            <a href="/partners" onClick={() => setOpen(false)}>Partners</a>
            <a href="/stores" onClick={() => setOpen(false)}>Stores</a>
            <a href="/policies" onClick={() => setOpen(false)}>Policies</a>
            <div className="mobile-nav-item">
              <button
                type="button"
                className="mobile-nav-trigger"
                onClick={() =>
                  setMobileDropdowns((prev) => ({
                    ...prev,
                    company: !prev.company,
                  }))
                }
              >
                <span>Company</span>
                <span className={`mobile-nav-caret ${mobileDropdowns.company ? "is-open" : ""}`} />
              </button>
              {mobileDropdowns.company ? (
                <div className="mobile-nav-submenu">
                  {companyMegaGroups[0]?.products.map((item) => (
                    <a key={`mobile-company-${item.id}`} href={item.href} onClick={() => setOpen(false)}>
                      {item.title}
                    </a>
                  ))}
                </div>
              ) : null}
            </div>
          </div>

          <div className="mobile-nav-categories">
            <p className="mobile-nav-section-label">All Categories</p>
            {categoryMenuLinks.length ? (
              categoryMenuLinks.map((group) => (
                <div key={group.category} className="mobile-nav-group">
                  <a
                    href={`/store?category=${encodeURIComponent(group.category)}`}
                    className="mobile-nav-group-title"
                    onClick={() => setOpen(false)}
                  >
                    {group.category}
                  </a>
                  {group.items.slice(0, 4).map((item) => (
                    <a
                      key={`${group.category}-${item.id}`}
                      href={item.href}
                      className="mobile-nav-group-item"
                      onClick={() => setOpen(false)}
                    >
                      {item.title}
                    </a>
                  ))}
                </div>
              ))
            ) : (
              <p className="mobile-nav-empty">No synced categories yet.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <header className="site-header site-header--enhanced">
      <div className="header-top">
        <div className="container header-top__inner">
          <a className="brand-block" href="/">
            <div className="logo">Revampfy</div>
            <p className="brand-tagline">
              Certified refurbished laptops for smart businesses.
            </p>
          </a>

          <div className="header-search">
            <input
              placeholder="Search laptops, desktops, accessories..."
              value={searchTerm}
              onChange={(event) => {
                setSearchTerm(event.target.value);
                setSearchOpen(true);
              }}
              onFocus={() => setSearchOpen(true)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  runSearch();
                }
              }}
            />
            <button className="search-btn" type="button" onClick={() => runSearch()}>
              Search
            </button>
            {searchOpen && productSuggestions.length ? (
              <div className="header-search__dropdown">
                {productSuggestions.map((product) => (
                  <button
                    type="button"
                    key={product.id}
                    className="header-search__item"
                    onClick={() => {
                      setSearchTerm(product.title);
                      runSearch(product.title);
                    }}
                  >
                    {product.title}
                  </button>
                ))}
              </div>
            ) : null}
          </div>

        </div>
      </div>

      <div className="header-tabs">
        <div className="container header-tabs__inner">
          <button
            className="nav__toggle"
            aria-label={open ? "Close menu" : "Open menu"}
            onClick={() => setOpen((prev) => !prev)}
          >
            <span />
            <span />
            <span />
          </button>

          <nav
            ref={navRef}
            className="nav nav--tabs"
            onMouseEnter={clearCloseTimer}
            onMouseLeave={scheduleCloseMega}
          >
            <ul className="nav__links nav__links--tabs nav__links--desktop">
              <li>
                <a
                  href="/"
                  className={pathname === "/" ? "nav__link--active" : ""}
                  onMouseEnter={() => setActiveMega(null)}
                >
                  Home
                </a>
              </li>
              <li>
                <button
                  type="button"
                  className={`nav__link-btn ${
                    activeMega === "categories" ? "nav__link-btn--active" : ""
                  }`}
                  onMouseEnter={(event) =>
                    openMegaAtTrigger("categories", event.currentTarget)
                  }
                  onFocus={(event) => openMegaAtTrigger("categories", event.currentTarget)}
                  onClick={() =>
                    setActiveMega((prev) => (prev === "categories" ? null : "categories"))
                  }
                >
                  All Categories <span className="menu-arrow">{"\u25BE"}</span>
                </button>
              </li>
              <li>
                <button
                  type="button"
                  className={`nav__link-btn ${
                    activeMega === "students" ? "nav__link-btn--active" : ""
                  }`}
                  onMouseEnter={(event) =>
                    openMegaAtTrigger("students", event.currentTarget)
                  }
                  onFocus={(event) => openMegaAtTrigger("students", event.currentTarget)}
                  onClick={() =>
                    setActiveMega((prev) => (prev === "students" ? null : "students"))
                  }
                >
                  Collections <span className="menu-arrow">{"\u25BE"}</span>
                </button>
              </li>
              <li>
                <a
                  href="/contact-us"
                  className={pathname === "/contact-us" ? "nav__link--active" : ""}
                  onMouseEnter={() => setActiveMega(null)}
                >
                  Businesses
                </a>
              </li>
              <li>
                <a
                  href="/bulk-orders-enquiry"
                  className={pathname === "/bulk-orders-enquiry" ? "nav__link--active" : ""}
                  onMouseEnter={() => setActiveMega(null)}
                >
                  Bulk Orders
                </a>
              </li>
              <li>
                <button
                  type="button"
                  className={`nav__link-btn ${
                    isCompanyActive || activeMega === "company"
                      ? "nav__link-btn--active"
                      : ""
                  }`}
                  onMouseEnter={(event) =>
                    openMegaAtTrigger("company", event.currentTarget)
                  }
                  onFocus={(event) => openMegaAtTrigger("company", event.currentTarget)}
                  onClick={() =>
                    setActiveMega((prev) => (prev === "company" ? null : "company"))
                  }
                >
                  Company <span className="menu-arrow">{"\u25BE"}</span>
                </button>
              </li>
            </ul>

            {activeMega === "categories" && (
              <div
                className="mega-menu mega-menu--catalog"
                role="menu"
                style={{ left: `${megaLeft}px` }}
                onMouseEnter={clearCloseTimer}
                onMouseLeave={scheduleCloseMega}
              >
                <h4>All Categories</h4>
                <div className="mega-menu__category-list">
                  {categoryMenuLinks.length ? (
                    categoryMenuLinks.map((group) => (
                      <div key={group.category} className="mega-menu__category-col">
                        <a
                          href={`/store?category=${encodeURIComponent(group.category)}`}
                          className="mega-menu__category-title"
                        >
                          {group.category}
                        </a>
                        {group.items.length ? (
                          group.items.map((item) => (
                            <a
                              key={`${group.category}-${item.id}`}
                              href={item.href}
                              className="mega-menu__category-product"
                            >
                              {item.title}
                            </a>
                          ))
                        ) : (
                          <a
                            href={`/store?category=${encodeURIComponent(group.category)}`}
                            className="mega-menu__category-product mega-menu__catalog-link--muted"
                          >
                            View category
                          </a>
                        )}
                      </div>
                    ))
                  ) : (
                    <p className="mega-menu__empty">
                      No synced categories yet. Run Shopify sync from admin.
                    </p>
                  )}
                </div>
              </div>
            )}

            {activeMega === "students" && (
              <div
                className="mega-menu mega-menu--catalog"
                id="students-menu"
                role="menu"
                style={{ left: `${megaLeft}px` }}
                onMouseEnter={clearCloseTimer}
                onMouseLeave={scheduleCloseMega}
              >
                <h4>Collections</h4>
                <div className="mega-menu__catalog-grid">
                  {collectionMegaGroups.length ? (
                    collectionMegaGroups.map((group) => (
                      <div key={group.id} className="mega-menu__catalog-col">
                        <a href={group.href} className="mega-menu__catalog-title">
                          {group.title}
                        </a>
                        {group.items.length ? (
                          group.items.map((item) => (
                            <a key={item.id} href={item.href} className="mega-menu__catalog-link">
                              {item.title}
                            </a>
                          ))
                        ) : (
                          <a href={group.href} className="mega-menu__catalog-link mega-menu__catalog-link--muted">
                            View collection
                          </a>
                        )}
                      </div>
                    ))
                  ) : (
                    <p className="mega-menu__empty">No collections synced yet.</p>
                  )}
                </div>
              </div>
            )}

            {activeMega === "company" && (
              <div
                className="mega-menu mega-menu--catalog mega-menu--company-horizontal"
                role="menu"
                style={{ left: `${megaLeft}px` }}
                onMouseEnter={clearCloseTimer}
                onMouseLeave={scheduleCloseMega}
              >
                <h4>Company</h4>
                <div className="mega-menu__company-row">
                  {companyMegaGroups[0]?.products.map((item) => (
                    <a
                      key={item.id}
                      href={item.href}
                      className="mega-menu__company-link"
                    >
                      {item.title}
                    </a>
                  ))}
                </div>
              </div>
            )}
          </nav>

          <div className="header__actions" onMouseEnter={() => setActiveMega(null)}>
            <a href="/store">
              <button className="primary top-selling-btn">Store</button>
            </a>
            <a
              href={accountHref}
            >
              <button className="ghost header-user-btn" aria-label="User">
                <svg className="header-icon-svg" viewBox="0 0 24 24" aria-hidden="true">
                  <circle cx="12" cy="8" r="4" />
                  <path d="M4 20c1.8-4 5-6 8-6s6.2 2 8 6" />
                </svg>
              </button>
            </a>
            <a href="/cart" className="header-bag" aria-label="Cart">
              <svg className="header-icon-svg" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M6 8h12l-1 11H7L6 8Z" />
                <path d="M9 8a3 3 0 0 1 6 0" />
              </svg>
              <span className="header-bag__count">{cartCount}</span>
            </a>
            <a href="/wishlist" className="header-bag header-wishlist" aria-label="Wishlist">
              <svg className="header-icon-svg" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M12 20s-7-4.6-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.4-7 10-7 10Z" />
              </svg>
              <span className="header-bag__count">{wishlistCount}</span>
            </a>
            <button
              type="button"
              className="ghost header-theme-btn"
              aria-label="Toggle theme"
              onClick={toggleThemeMode}
              title={themeMode === "dark" ? "Switch to Light Theme" : "Switch to Dark Theme"}
            >
              <ThemeIcon mode={themeMode} />
            </button>
          </div>
        </div>
      </div>
      {mounted ? createPortal(mobileMenuOverlay, document.body) : null}
    </header>
  );
}


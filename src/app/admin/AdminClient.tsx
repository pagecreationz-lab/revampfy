"use client";

import { useEffect, useMemo, useState } from "react";
import type { HomepageConfig } from "@/lib/homepage";
import {
  type SiteBuilderItem,
  type SiteContent,
  type SitePageBlock,
  type SitePageKey,
  type SiteThemeMode,
  SITE_PAGE_OPTIONS,
} from "@/lib/siteContentSchema";
import { readJsonSafe } from "@/lib/httpClient";

type TabKey = "cms" | "sync" | "pages";

type Collection = {
  id: number;
  title: string;
  handle: string;
  body_html?: string | null;
  collection_type?: "custom" | "smart" | "derived";
};

type Product = {
  id: number;
  title: string;
  handle: string;
  tags?: string;
  status?: string;
  vendor?: string;
  product_type?: string;
  category?: string;
};

type ShopifyMode = "admin_token" | "client_credentials" | "oauth";
type SchedulerMode = "manual" | "hourly";

type EnquirySettingsState = {
  mailTo: string;
  smtpHost: string;
  smtpPort: string;
  smtpUser: string;
  smtpPass: string;
  smtpFrom: string;
  maskedSmtpPass: string;
};

type AuthSettingsState = {
  enableEmailPasswordLogin: boolean;
  enableEmailCodeLogin: boolean;
  enableMobileOtpLogin: boolean;
  enableGoogleLogin: boolean;
  googleClientId: string;
  googleClientSecret: string;
  googleRedirectUri: string;
  maskedGoogleClientSecret: string;
  twilioAccountSid: string;
  twilioAuthToken: string;
  twilioVerifyServiceSid: string;
  maskedTwilioAuthToken: string;
};

type CommerceConfigState = {
  enablePayments: boolean;
  enableCheckout: boolean;
  enableCustomerAccounts: boolean;
  enableShippingDelivery: boolean;
  enableTaxesDuties: boolean;
  enableInventoryStock: boolean;
  enableNotifications: boolean;
  enableCustomerPolicy: boolean;
  enableTwoWaySync: boolean;
  notificationEmail: string;
  shippingPolicy: string;
  returnsPolicy: string;
  warrantyPolicy: string;
  privacyPolicy: string;
  taxRatePct: number;
  shippingFlatRate: number;
};

const emptyConfig: HomepageConfig = {
  categoryCollectionHandles: [],
  featuredBrands: [],
  featuredVendors: [],
  studentsProductIds: [],
  topSellingProductIds: [],
};

const emptyContent: SiteContent = {
  themeMode: "dark",
  home: { title: "", subtitle: "", heroImageUrl: "", programsImageUrl: "" },
  contactUs: "",
  aboutUs: "",
  partners: "",
  storeLocator: "",
  pageBuilder: {
    homePage: [],
    aboutUsPage: [],
    partnersPage: [],
    storesPage: [],
    contactUsPage: [],
    bulkOrdersPage: [],
    companyPage: [],
    policiesPage: [],
  },
};

const emptyEnquirySettings: EnquirySettingsState = {
  mailTo: "support@revampfy.in",
  smtpHost: "",
  smtpPort: "587",
  smtpUser: "",
  smtpPass: "",
  smtpFrom: "",
  maskedSmtpPass: "",
};

const emptyAuthSettings: AuthSettingsState = {
  enableEmailPasswordLogin: false,
  enableEmailCodeLogin: true,
  enableMobileOtpLogin: false,
  enableGoogleLogin: true,
  googleClientId: "",
  googleClientSecret: "",
  googleRedirectUri: "",
  maskedGoogleClientSecret: "",
  twilioAccountSid: "",
  twilioAuthToken: "",
  twilioVerifyServiceSid: "",
  maskedTwilioAuthToken: "",
};

const emptyCommerceConfig: CommerceConfigState = {
  enablePayments: true,
  enableCheckout: true,
  enableCustomerAccounts: true,
  enableShippingDelivery: true,
  enableTaxesDuties: true,
  enableInventoryStock: true,
  enableNotifications: true,
  enableCustomerPolicy: true,
  enableTwoWaySync: true,
  notificationEmail: "support@revampfy.in",
  shippingPolicy: "Orders are dispatched in 24-48 hours with tracking updates.",
  returnsPolicy: "Returns accepted within 7 days for eligible products.",
  warrantyPolicy: "Certified products include warranty support as listed on product pages.",
  privacyPolicy: "Customer data is used for fulfilment, support, and compliance only.",
  taxRatePct: 18,
  shippingFlatRate: 199,
};

export default function AdminClient({
  initialConfig,
}: {
  initialConfig: HomepageConfig;
}) {
  const [activeTab, setActiveTab] = useState<TabKey>("cms");
  const [config, setConfig] = useState<HomepageConfig>(initialConfig || emptyConfig);
  const [siteContent, setSiteContent] = useState<SiteContent>(emptyContent);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [brands, setBrands] = useState<string[]>([]);
  const [vendors, setVendors] = useState<string[]>([]);
  const [syncedAt, setSyncedAt] = useState<string>("");
  const [nowTs, setNowTs] = useState<number>(Date.now());
  const [shopifyMode, setShopifyMode] = useState<ShopifyMode>("admin_token");
  const [shopifyStoreDomain, setShopifyStoreDomain] = useState("");
  const [shopifyAccessToken, setShopifyAccessToken] = useState("");
  const [shopifyClientId, setShopifyClientId] = useState("");
  const [shopifyClientSecret, setShopifyClientSecret] = useState("");
  const [shopifyApiVersion, setShopifyApiVersion] = useState("2024-10");
  const [shopifyMaskedToken, setShopifyMaskedToken] = useState("");
  const [shopifyMaskedClientSecret, setShopifyMaskedClientSecret] = useState("");
  const [shopifyConnected, setShopifyConnected] = useState(false);
  const [shopName, setShopName] = useState("");
  const [shopifyHint, setShopifyHint] = useState("");
  const [grantedScopes, setGrantedScopes] = useState<string[]>([]);
  const [scopeError, setScopeError] = useState("");
  const [enquirySettings, setEnquirySettings] =
    useState<EnquirySettingsState>(emptyEnquirySettings);
  const [authSettings, setAuthSettings] = useState<AuthSettingsState>(emptyAuthSettings);
  const [commerceConfig, setCommerceConfig] = useState<CommerceConfigState>(emptyCommerceConfig);
  const [schedulerMode, setSchedulerMode] = useState<SchedulerMode>("manual");
  const [message, setMessage] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [testingTwilio, setTestingTwilio] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [uploadingHeroImage, setUploadingHeroImage] = useState(false);
  const [uploadingProgramsImage, setUploadingProgramsImage] = useState(false);

  const [collectionQuery, setCollectionQuery] = useState("");
  const [productQuery, setProductQuery] = useState("");
  const [brandQuery, setBrandQuery] = useState("");
  const [vendorQuery, setVendorQuery] = useState("");

  const [productPage, setProductPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const [selectedProductId, setSelectedProductId] = useState<string>("");
  const [productTitle, setProductTitle] = useState<string>("");
  const [productTags, setProductTags] = useState<string>("");
  const [productStatus, setProductStatus] = useState<string>("");

  const [selectedCollectionId, setSelectedCollectionId] = useState<string>("");
  const [collectionTitle, setCollectionTitle] = useState<string>("");
  const [collectionDescription, setCollectionDescription] = useState<string>("");
  const [selectedBuilderPage, setSelectedBuilderPage] = useState<SitePageKey>("homePage");

  useEffect(() => {
    const loadInitial = async () => {
      try {
        const [syncRes, contentRes] = await Promise.all([
          fetch("/api/shopify/sync"),
          fetch("/api/admin/site-content"),
        ]);

        const syncJson = await readJsonSafe(syncRes);
        const contentJson = await readJsonSafe(contentRes);

        if (syncJson.error) {
          throw new Error(syncJson.error);
        }

        const payload = syncJson.payload;
        setCollections(payload?.categories || []);
        setProducts(payload?.products || []);
        setBrands(payload?.brands || []);
        setVendors(payload?.vendors || []);
        setSyncedAt(syncJson.cached?.syncedAt || "");

        if (!contentJson.error) {
          setSiteContent(contentJson.content || emptyContent);
        }

        const [connectionRes, schedulerRes, authSettingsRes, commerceRes] = await Promise.all([
          fetch("/api/admin/shopify-connection"),
          fetch("/api/admin/shopify-sync-scheduler"),
          fetch("/api/admin/auth-settings"),
          fetch("/api/admin/commerce-config"),
        ]);
        const enquiryRes = await fetch("/api/admin/enquiry-settings");

        const connectionJson = await readJsonSafe(connectionRes);
        const schedulerJson = await readJsonSafe(schedulerRes);
        const authSettingsJson = await readJsonSafe(authSettingsRes);
        const commerceJson = await readJsonSafe(commerceRes);
        const enquiryJson = await readJsonSafe(enquiryRes);
        if (!connectionJson.error) {
          setShopifyConnected(Boolean(connectionJson.connected));
          setShopName(connectionJson.shopName || "");
          setShopifyMode(connectionJson.settings?.mode || "admin_token");
          setShopifyStoreDomain(connectionJson.settings?.storeDomain || "");
          setShopifyApiVersion(connectionJson.settings?.apiVersion || "2024-10");
          setShopifyMaskedToken(connectionJson.settings?.maskedAccessToken || "");
          setShopifyClientId(connectionJson.settings?.clientId || "");
          setShopifyMaskedClientSecret(connectionJson.settings?.maskedClientSecret || "");
          setShopifyHint(connectionJson.hint || "");
          setGrantedScopes(connectionJson.grantedScopes || []);
          setScopeError(connectionJson.scopeError || "");
        }

        if (!schedulerJson.error) {
          setSchedulerMode(schedulerJson?.settings?.mode === "hourly" ? "hourly" : "manual");
        }

        if (!enquiryJson.error) {
          setEnquirySettings({
            mailTo: enquiryJson.settings?.mailTo || "support@revampfy.in",
            smtpHost: enquiryJson.settings?.smtpHost || "",
            smtpPort: String(enquiryJson.settings?.smtpPort || "587"),
            smtpUser: enquiryJson.settings?.smtpUser || "",
            smtpPass: "",
            smtpFrom: enquiryJson.settings?.smtpFrom || "",
            maskedSmtpPass: enquiryJson.settings?.maskedSmtpPass || "",
          });
        }

        if (!authSettingsJson.error) {
          setAuthSettings({
            enableEmailPasswordLogin: Boolean(authSettingsJson.settings?.enableEmailPasswordLogin),
            enableEmailCodeLogin: Boolean(authSettingsJson.settings?.enableEmailCodeLogin),
            enableMobileOtpLogin: Boolean(authSettingsJson.settings?.enableMobileOtpLogin),
            enableGoogleLogin: Boolean(authSettingsJson.settings?.enableGoogleLogin),
            googleClientId: authSettingsJson.settings?.googleClientId || "",
            googleClientSecret: "",
            googleRedirectUri: authSettingsJson.settings?.googleRedirectUri || "",
            maskedGoogleClientSecret: authSettingsJson.settings?.maskedGoogleClientSecret || "",
            twilioAccountSid: authSettingsJson.settings?.twilioAccountSid || "",
            twilioAuthToken: "",
            twilioVerifyServiceSid: authSettingsJson.settings?.twilioVerifyServiceSid || "",
            maskedTwilioAuthToken: authSettingsJson.settings?.maskedTwilioAuthToken || "",
          });
        }

        if (!commerceJson.error && commerceJson.config) {
          setCommerceConfig({
            ...emptyCommerceConfig,
            ...commerceJson.config,
            taxRatePct: Number(commerceJson.config.taxRatePct || 0),
            shippingFlatRate: Number(commerceJson.config.shippingFlatRate || 0),
          });
        }

        const params = new URLSearchParams(window.location.search);
        const tabParam = params.get("tab");
        const productIdParam = params.get("productId");
        if (tabParam === "sync" || tabParam === "cms" || tabParam === "pages") {
          setActiveTab(tabParam);
        }
        if (productIdParam) {
          setSelectedProductId(productIdParam);
          setActiveTab("sync");
        }
        const oauthStatus = params.get("oauth");
        const oauthMessage = params.get("message");
        if (oauthStatus === "success") {
          setMessage("Shopify connected via OAuth successfully.");
          setError("");
        } else if (oauthStatus === "error") {
          setError(oauthMessage || "Shopify OAuth connection failed.");
        }

        if (oauthStatus) {
          params.delete("oauth");
          params.delete("message");
          const cleanedQuery = params.toString();
          const nextUrl = `${window.location.pathname}${cleanedQuery ? `?${cleanedQuery}` : ""}`;
          window.history.replaceState({}, "", nextUrl);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unable to load admin data.");
      }
    };

    loadInitial();
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => setNowTs(Date.now()), 30000);
    return () => window.clearInterval(timer);
  }, []);

  const syncBadge = useMemo(() => {
    if (!syncedAt) return "Never synced";
    const syncedMs = new Date(syncedAt).getTime();
    if (Number.isNaN(syncedMs)) return "Sync time unavailable";
    const diffMin = Math.max(0, Math.floor((nowTs - syncedMs) / 60000));
    if (diffMin <= 0) return "Last synced just now";
    if (diffMin === 1) return "Last synced 1 min ago";
    return `Last synced ${diffMin} mins ago`;
  }, [syncedAt, nowTs]);

  const selectedProduct = useMemo(
    () => products.find((product) => String(product.id) === selectedProductId),
    [products, selectedProductId]
  );

  const selectedCollection = useMemo(
    () => collections.find((collection) => String(collection.id) === selectedCollectionId),
    [collections, selectedCollectionId]
  );

  useEffect(() => {
    if (!selectedProduct) return;
    setProductTitle(selectedProduct.title || "");
    setProductTags(selectedProduct.tags || "");
    setProductStatus(selectedProduct.status || "");
  }, [selectedProduct]);

  useEffect(() => {
    if (!selectedCollection) return;
    setCollectionTitle(selectedCollection.title || "");
    setCollectionDescription(selectedCollection.body_html || "");
  }, [selectedCollection]);

  const filteredCollections = useMemo(() => {
    const query = collectionQuery.trim().toLowerCase();
    if (!query) return collections;
    return collections.filter(
      (c) => c.title.toLowerCase().includes(query) || c.handle.toLowerCase().includes(query)
    );
  }, [collections, collectionQuery]);

  const filteredProducts = useMemo(() => {
    const query = productQuery.trim().toLowerCase();
    if (!query) return products;
    return products.filter(
      (p) =>
        p.title.toLowerCase().includes(query) ||
        p.handle.toLowerCase().includes(query) ||
        (p.vendor || "").toLowerCase().includes(query)
    );
  }, [products, productQuery]);

  const pagedProducts = useMemo(() => {
    const start = (productPage - 1) * pageSize;
    return filteredProducts.slice(start, start + pageSize);
  }, [filteredProducts, productPage, pageSize]);

  const totalProductPages = Math.max(1, Math.ceil(filteredProducts.length / pageSize));

  const filteredBrands = useMemo(() => {
    const query = brandQuery.trim().toLowerCase();
    return brands.filter((b) => b.toLowerCase().includes(query));
  }, [brands, brandQuery]);

  const filteredVendors = useMemo(() => {
    const query = vendorQuery.trim().toLowerCase();
    return vendors.filter((v) => v.toLowerCase().includes(query));
  }, [vendors, vendorQuery]);

  const toggleString = (value: string, field: "featuredBrands" | "featuredVendors") => {
    setConfig((prev) => {
      const list = prev[field] || [];
      const exists = list.includes(value);
      return {
        ...prev,
        [field]: exists ? list.filter((item) => item !== value) : [...list, value],
      };
    });
  };

  const toggleCollection = (handle: string) => {
    setConfig((prev) => {
      const exists = prev.categoryCollectionHandles.includes(handle);
      return {
        ...prev,
        categoryCollectionHandles: exists
          ? prev.categoryCollectionHandles.filter((item) => item !== handle)
          : [...prev.categoryCollectionHandles, handle],
      };
    });
  };

  const toggleProduct = (id: number) => {
    setConfig((prev) => {
      const exists = prev.topSellingProductIds.includes(id);
      return {
        ...prev,
        topSellingProductIds: exists
          ? prev.topSellingProductIds.filter((item) => item !== id)
          : [...prev.topSellingProductIds, id],
      };
    });
  };

  const saveConfig = async () => {
    setError("");
    setMessage("");
    try {
      const res = await fetch("/api/admin/homepage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
      const json = await readJsonSafe(res);
      if (!res.ok) {
        throw new Error(json.error || "Failed to save CMS config");
      }
      setConfig(json.config);
      setMessage("CMS configuration saved.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    }
  };

  const savePages = async () => {
    setError("");
    setMessage("");
    try {
      const res = await fetch("/api/admin/site-content", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(siteContent),
      });
      const json = await readJsonSafe(res);
      if (!res.ok) {
        throw new Error(json.error || "Failed to save page content");
      }
      setSiteContent(json.content);
      setMessage("Site pages content saved.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    }
  };

  const syncNow = async () => {
    setError("");
    setMessage("");
    try {
      const res = await fetch("/api/shopify/sync", { method: "POST" });
      const json = await readJsonSafe(res);
      if (!res.ok) {
        throw new Error(json.error || "Sync failed");
      }
      const payload = json.saved?.payload;
      setCollections(payload?.categories || []);
      setProducts(payload?.products || []);
      setBrands(payload?.brands || []);
      setVendors(payload?.vendors || []);
      setSyncedAt(json.saved?.syncedAt || "");
      setMessage("Shopify sync completed.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sync failed");
    }
  };

  const saveSchedulerMode = async () => {
    setError("");
    setMessage("");
    try {
      const res = await fetch("/api/admin/shopify-sync-scheduler", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: schedulerMode }),
      });
      const json = await readJsonSafe(res);
      if (!res.ok) {
        throw new Error(json.error || "Failed to save scheduler mode");
      }
      setSchedulerMode(json?.settings?.mode === "hourly" ? "hourly" : "manual");
      setMessage(
        json?.settings?.mode === "hourly"
          ? "Auto-sync enabled (hourly)."
          : "Auto-sync set to manual."
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save scheduler mode");
    }
  };

  const saveEnquirySettings = async () => {
    setError("");
    setMessage("");
    try {
      const res = await fetch("/api/admin/enquiry-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mailTo: enquirySettings.mailTo,
          smtpHost: enquirySettings.smtpHost,
          smtpPort: Number(enquirySettings.smtpPort || 587),
          smtpUser: enquirySettings.smtpUser,
          smtpPass: enquirySettings.smtpPass,
          smtpFrom: enquirySettings.smtpFrom,
        }),
      });
      const json = await readJsonSafe(res);
      if (!res.ok) {
        throw new Error(json.error || "Failed to save email integration");
      }
      setEnquirySettings((prev) => ({
        ...prev,
        mailTo: json.settings?.mailTo || prev.mailTo,
        smtpHost: json.settings?.smtpHost || prev.smtpHost,
        smtpPort: String(json.settings?.smtpPort || prev.smtpPort),
        smtpUser: json.settings?.smtpUser || prev.smtpUser,
        smtpPass: "",
        smtpFrom: json.settings?.smtpFrom || prev.smtpFrom,
        maskedSmtpPass: json.settings?.maskedSmtpPass || prev.maskedSmtpPass,
      }));
      setMessage("Email integration saved for Contact Us and Bulk Enquiry notifications.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save email integration");
    }
  };

  const saveAuthSettings = async () => {
    setError("");
    setMessage("");
    try {
      const res = await fetch("/api/admin/auth-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          enableEmailPasswordLogin: authSettings.enableEmailPasswordLogin,
          enableEmailCodeLogin: authSettings.enableEmailCodeLogin,
          enableMobileOtpLogin: authSettings.enableMobileOtpLogin,
          enableGoogleLogin: authSettings.enableGoogleLogin,
          googleClientId: authSettings.googleClientId,
          googleClientSecret: authSettings.googleClientSecret,
          googleRedirectUri: authSettings.googleRedirectUri,
          twilioAccountSid: authSettings.twilioAccountSid,
          twilioAuthToken: authSettings.twilioAuthToken,
          twilioVerifyServiceSid: authSettings.twilioVerifyServiceSid,
        }),
      });
      const json = await readJsonSafe(res);
      if (!res.ok) {
        throw new Error(json.error || "Failed to save auth settings");
      }
      setAuthSettings((prev) => ({
        ...prev,
        enableEmailPasswordLogin: Boolean(json.settings?.enableEmailPasswordLogin),
        enableEmailCodeLogin: Boolean(json.settings?.enableEmailCodeLogin),
        enableMobileOtpLogin: Boolean(json.settings?.enableMobileOtpLogin),
        enableGoogleLogin: Boolean(json.settings?.enableGoogleLogin),
        googleClientId: json.settings?.googleClientId || "",
        googleClientSecret: "",
        googleRedirectUri: json.settings?.googleRedirectUri || "",
        maskedGoogleClientSecret: json.settings?.maskedGoogleClientSecret || "",
        twilioAccountSid: json.settings?.twilioAccountSid || "",
        twilioAuthToken: "",
        twilioVerifyServiceSid: json.settings?.twilioVerifyServiceSid || "",
        maskedTwilioAuthToken: json.settings?.maskedTwilioAuthToken || "",
      }));
      setMessage("Login methods settings saved.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save auth settings");
    }
  };

  const testTwilioCredentials = async () => {
    setError("");
    setMessage("");
    setTestingTwilio(true);
    try {
      const res = await fetch("/api/admin/auth-settings/test-twilio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          twilioAccountSid: authSettings.twilioAccountSid,
          twilioAuthToken: authSettings.twilioAuthToken,
          twilioVerifyServiceSid: authSettings.twilioVerifyServiceSid,
        }),
      });
      const json = await readJsonSafe(res);
      if (!res.ok || !Boolean(json?.ok)) {
        throw new Error(String(json?.error || "Twilio credentials test failed."));
      }
      setMessage(String(json?.message || "Twilio credentials are valid."));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Twilio credentials test failed.");
    } finally {
      setTestingTwilio(false);
    }
  };

  const saveCommerceConfig = async () => {
    setError("");
    setMessage("");
    try {
      const res = await fetch("/api/admin/commerce-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(commerceConfig),
      });
      const json = await readJsonSafe(res);
      if (!res.ok) {
        throw new Error(json.error || "Failed to save commerce config");
      }
      setCommerceConfig({
        ...emptyCommerceConfig,
        ...json.config,
        taxRatePct: Number(json.config?.taxRatePct || 0),
        shippingFlatRate: Number(json.config?.shippingFlatRate || 0),
      });
      setMessage("Shopify commerce modules configuration saved.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save commerce config");
    }
  };

  const saveShopifyConnection = async () => {
    setError("");
    setMessage("");
    setShopifyHint("");
    if (shopifyStoreDomain.includes("http://") || shopifyStoreDomain.includes("https://")) {
      setError("Store domain must be like yourstore.myshopify.com (without https://).");
      return;
    }
    if (shopifyMode === "oauth") {
      setError("Use Connect Shopify for OAuth mode.");
      return;
    }

    if (shopifyMode === "admin_token") {
      if (!shopifyAccessToken) {
        setError("Please paste Admin API access token from Shopify custom app.");
        return;
      }
    } else {
      if (!shopifyClientId || !shopifyClientSecret) {
        setError("Please provide Client ID and Client Secret.");
        return;
      }
    }
    try {
      const res = await fetch("/api/admin/shopify-connection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: shopifyMode,
          storeDomain: shopifyStoreDomain,
          accessToken: shopifyAccessToken,
          clientId: shopifyClientId,
          clientSecret: shopifyClientSecret,
          apiVersion: shopifyApiVersion,
        }),
      });
      const json = await readJsonSafe(res);
      if (!res.ok) {
        setShopifyHint(json.hint || "");
        throw new Error(json.error || "Failed to save Shopify connection");
      }
      setShopifyConnected(true);
      setShopName(json.shopName || "");
      setShopifyMode(json.settings?.mode || shopifyMode);
      setShopifyMaskedToken(json.settings?.maskedAccessToken || "");
      setShopifyClientId(json.settings?.clientId || "");
      setShopifyMaskedClientSecret(json.settings?.maskedClientSecret || "");
      setShopifyAccessToken("");
      setShopifyClientSecret("");
      setShopifyHint("");
      setGrantedScopes(json.grantedScopes || []);
      setScopeError(json.scopeError || "");
      setMessage(`Shopify connected successfully${json.shopName ? `: ${json.shopName}` : ""}.`);
    } catch (err) {
      setShopifyConnected(false);
      setGrantedScopes([]);
      setScopeError("");
      setError(err instanceof Error ? err.message : "Connection failed");
    }
  };

  const connectShopifyOAuth = async () => {
    setError("");
    setMessage("");
    setShopifyHint("");

    if (!shopifyStoreDomain) {
      setError("Please enter store domain before connecting.");
      return;
    }

    if (shopifyStoreDomain.includes("http://") || shopifyStoreDomain.includes("https://")) {
      setError("Store domain must be like yourstore.myshopify.com (without https://).");
      return;
    }

    try {
      const res = await fetch("/api/admin/shopify-connection/oauth-start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storeDomain: shopifyStoreDomain.trim(),
          apiVersion: shopifyApiVersion.trim() || "2024-10",
        }),
      });
      const json = await readJsonSafe(res);
      if (!res.ok) {
        throw new Error(json.error || "Unable to start OAuth install flow.");
      }
      if (!json.authUrl) {
        throw new Error("Missing OAuth authorization URL.");
      }
      window.location.href = json.authUrl as string;
    } catch (err) {
      setError(err instanceof Error ? err.message : "OAuth start failed.");
    }
  };

  const updateShopifyProduct = async () => {
    if (!selectedProductId) return;
    setError("");
    setMessage("");
    try {
      const res = await fetch(`/api/shopify/products/${selectedProductId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: productTitle, tags: productTags, status: productStatus }),
      });
      const json = await readJsonSafe(res);
      if (!res.ok) {
        throw new Error(json.error || "Failed to update product");
      }
      setProducts((prev) => prev.map((p) => (p.id === json.product.id ? json.product : p)));
      setMessage("Shopify product updated.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed");
    }
  };

  const updateShopifyCollection = async () => {
    if (!selectedCollectionId) return;
    setError("");
    setMessage("");
    try {
      const res = await fetch("/api/shopify/collections", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: Number(selectedCollectionId),
          title: collectionTitle,
          body_html: collectionDescription,
          collection_type: selectedCollection?.collection_type,
        }),
      });
      const json = await readJsonSafe(res);
      if (!res.ok) {
        throw new Error(json.error || "Failed to update collection");
      }
      setCollections((prev) => prev.map((c) => (c.id === json.collection.id ? json.collection : c)));
      setMessage("Shopify collection updated.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed");
    }
  };

  const uploadHeroImage = async (file: File) => {
    setError("");
    setMessage("");
    setUploadingHeroImage(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/admin/upload-image", {
        method: "POST",
        body: formData,
      });
      const json = await readJsonSafe(res);
      if (!res.ok) {
        throw new Error(json.error || "Image upload failed.");
      }
      setSiteContent((prev) => ({
        ...prev,
        home: { ...prev.home, heroImageUrl: json.url || "" },
      }));
      setMessage("Hero image uploaded. Save Site Pages to publish.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Image upload failed.");
    } finally {
      setUploadingHeroImage(false);
    }
  };

  const uploadProgramsImage = async (file: File) => {
    setError("");
    setMessage("");
    setUploadingProgramsImage(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/admin/upload-image", {
        method: "POST",
        body: formData,
      });
      const json = await readJsonSafe(res);
      if (!res.ok) {
        throw new Error(json.error || "Image upload failed.");
      }
      setSiteContent((prev) => ({
        ...prev,
        home: { ...prev.home, programsImageUrl: json.url || "" },
      }));
      setMessage("Programs section image uploaded.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Image upload failed.");
    } finally {
      setUploadingProgramsImage(false);
    }
  };

  const getBlocks = (page: SitePageKey) => siteContent.pageBuilder?.[page] || [];

  const updateBlocks = (page: SitePageKey, updater: (prev: SitePageBlock[]) => SitePageBlock[]) => {
    setSiteContent((prev) => ({
      ...prev,
      pageBuilder: {
        ...prev.pageBuilder,
        [page]: updater(prev.pageBuilder?.[page] || []),
      },
    }));
  };

  const addBlock = (page: SitePageKey, type: SitePageBlock["type"]) => {
    const timestamp = Date.now();
    const base: SitePageBlock =
      type === "featureGrid"
        ? {
            id: `block-${timestamp}`,
            type,
            theme: "dark",
            title: "New feature grid",
            items: [
              { id: `item-${timestamp}-1`, title: "Feature 1", description: "Description 1" },
              { id: `item-${timestamp}-2`, title: "Feature 2", description: "Description 2" },
            ],
          }
        : {
            id: `block-${timestamp}`,
            type,
            theme: "dark",
            title: type === "hero" ? "New hero heading" : "New text block",
            content: "Add content here.",
          };

    updateBlocks(page, (prev) => [...prev, base]);
  };

  const updateBlock = (
    page: SitePageKey,
    blockId: string,
    patch: Partial<SitePageBlock>
  ) => {
    updateBlocks(page, (prev) =>
      prev.map((block) => (block.id === blockId ? { ...block, ...patch } : block))
    );
  };

  const moveBlock = (page: SitePageKey, blockId: string, direction: -1 | 1) => {
    updateBlocks(page, (prev) => {
      const index = prev.findIndex((block) => block.id === blockId);
      if (index < 0) return prev;
      const target = index + direction;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const deleteBlock = (page: SitePageKey, blockId: string) => {
    updateBlocks(page, (prev) => prev.filter((block) => block.id !== blockId));
  };

  const updateFeatureItem = (
    page: SitePageKey,
    blockId: string,
    itemId: string,
    patch: Partial<SiteBuilderItem>
  ) => {
    updateBlocks(page, (prev) =>
      prev.map((block) => {
        if (block.id !== blockId || block.type !== "featureGrid") return block;
        const items = (block.items || []).map((item) =>
          item.id === itemId ? { ...item, ...patch } : item
        );
        return { ...block, items };
      })
    );
  };

  const addFeatureItem = (page: SitePageKey, blockId: string) => {
    updateBlocks(page, (prev) =>
      prev.map((block) => {
        if (block.id !== blockId || block.type !== "featureGrid") return block;
        const items = block.items || [];
        return {
          ...block,
          items: [
            ...items,
            {
              id: `item-${Date.now()}-${items.length + 1}`,
              title: `Feature ${items.length + 1}`,
              description: "Description",
            },
          ],
        };
      })
    );
  };

  const removeFeatureItem = (page: SitePageKey, blockId: string, itemId: string) => {
    updateBlocks(page, (prev) =>
      prev.map((block) => {
        if (block.id !== blockId || block.type !== "featureGrid") return block;
        return {
          ...block,
          items: (block.items || []).filter((item) => item.id !== itemId),
        };
      })
    );
  };

  const syncHomeHeroWithGlobal = (
    prev: SiteContent,
    nextHome: SiteContent["home"]
  ): SiteContent => {
    const homeBlocks = [...(prev.pageBuilder.homePage || [])];
    const heroIndex = homeBlocks.findIndex((block) => block.type === "hero");

    if (heroIndex >= 0) {
      homeBlocks[heroIndex] = {
        ...homeBlocks[heroIndex],
        title: nextHome.title || homeBlocks[heroIndex].title,
        content: nextHome.subtitle || homeBlocks[heroIndex].content,
      };
    } else {
      homeBlocks.unshift({
        id: `home-hero-${Date.now()}`,
        type: "hero",
        theme: "dark",
        eyebrow: "Revampfy",
        title: nextHome.title || "",
        content: nextHome.subtitle || "",
        ctaLabel: "Shop Deals",
        ctaHref: "/#deals",
        items: [],
      });
    }

    return {
      ...prev,
      home: nextHome,
      pageBuilder: {
        ...prev.pageBuilder,
        homePage: homeBlocks,
      },
    };
  };

  const logoutAdmin = async () => {
    setLoggingOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      window.location.href = "/admin-login";
    } finally {
      setLoggingOut(false);
    }
  };

  return (
    <div className="admin__layout">
      <aside className="admin__tabs admin__tabs--vertical">
        <button className={activeTab === "cms" ? "primary" : "ghost"} onClick={() => setActiveTab("cms")}>
          CMS Admin
        </button>
        <button className={activeTab === "sync" ? "primary" : "ghost"} onClick={() => setActiveTab("sync")}>
          Shopify Sync
        </button>
        <button className={activeTab === "pages" ? "primary" : "ghost"} onClick={() => setActiveTab("pages")}>
          Site Pages
        </button>
        <button className="ghost admin__logout-btn" type="button" onClick={logoutAdmin} disabled={loggingOut}>
          {loggingOut ? "Logging out..." : "Logout"}
        </button>
      </aside>

      <div className="admin__content">
        {error && <div className="admin__alert admin__alert--error">{error}</div>}
        {message && <div className="admin__alert admin__alert--success">{message}</div>}

        {activeTab === "cms" && (
        <div className="admin__panel">
          <h2>CMS Admin Panel</h2>
          <p className="hero__subtext">
            Select homepage data synced from Shopify for Categories, Brands, Vendors, and Products.
          </p>

          <div className="admin__grid">
            <div>
              <div className="admin__filters">
                <h3>Categories</h3>
                <input value={collectionQuery} onChange={(e) => setCollectionQuery(e.target.value)} placeholder="Search categories" />
              </div>
              <div className="admin__list">
                {filteredCollections.map((collection) => (
                  <label className="admin__item" key={collection.id}>
                    <input
                      type="checkbox"
                      checked={config.categoryCollectionHandles.includes(collection.handle)}
                      onChange={() => toggleCollection(collection.handle)}
                    />
                    <div>
                      <strong>{collection.title}</strong>
                      <small>Handle: {collection.handle}</small>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <div className="admin__filters">
                <h3>Brands</h3>
                <input value={brandQuery} onChange={(e) => setBrandQuery(e.target.value)} placeholder="Search brands" />
              </div>
              <div className="admin__list">
                {filteredBrands.map((brand) => (
                  <label className="admin__item" key={brand}>
                    <input
                      type="checkbox"
                      checked={config.featuredBrands.includes(brand)}
                      onChange={() => toggleString(brand, "featuredBrands")}
                    />
                    <div>
                      <strong>{brand}</strong>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <div className="admin__filters">
                <h3>Vendors</h3>
                <input value={vendorQuery} onChange={(e) => setVendorQuery(e.target.value)} placeholder="Search vendors" />
              </div>
              <div className="admin__list">
                {filteredVendors.map((vendor) => (
                  <label className="admin__item" key={vendor}>
                    <input
                      type="checkbox"
                      checked={config.featuredVendors.includes(vendor)}
                      onChange={() => toggleString(vendor, "featuredVendors")}
                    />
                    <div>
                      <strong>{vendor}</strong>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <div className="admin__filters">
                <h3>Products</h3>
                <input value={productQuery} onChange={(e) => setProductQuery(e.target.value)} placeholder="Search products" />
              </div>
              <div className="admin__list">
                {pagedProducts.map((product) => (
                  <label className="admin__item" key={product.id}>
                    <input
                      type="checkbox"
                      checked={config.topSellingProductIds.includes(product.id)}
                      onChange={() => toggleProduct(product.id)}
                    />
                    <div>
                      <strong>{product.title}</strong>
                      <small>
                        Vendor: {product.vendor || "N/A"} | Category:{" "}
                        {product.category || product.product_type || "N/A"}
                      </small>
                      <small>Tags: {product.tags || "No tags"}</small>
                    </div>
                  </label>
                ))}
              </div>
              <div className="admin__pagination">
                <label>
                  Page size
                  <select value={pageSize} onChange={(e) => setPageSize(Number(e.target.value))}>
                    <option value={10}>10</option>
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                  </select>
                </label>
                <div className="admin__pagination-buttons">
                  <button className="secondary" disabled={productPage <= 1} onClick={() => setProductPage((p) => p - 1)}>
                    Prev
                  </button>
                  <button className="ghost">{productPage} / {totalProductPages}</button>
                  <button className="secondary" disabled={productPage >= totalProductPages} onClick={() => setProductPage((p) => p + 1)}>
                    Next
                  </button>
                </div>
              </div>
            </div>

          </div>

          <button className="primary" onClick={saveConfig}>Save CMS Config</button>
        </div>
        )}

        {activeTab === "sync" && (
        <div className="admin__panel">
          <h2>Shopify Sync</h2>
          <p className="hero__subtext">
            Sync Categories, Brands, Vendors, and Products from Shopify Admin API into your CMS.
          </p>
          <div className="admin__form" style={{ marginBottom: "1rem" }}>
            <h3>Shopify Connection</h3>
            <select value={shopifyMode} onChange={(e) => setShopifyMode(e.target.value as ShopifyMode)}>
              <option value="admin_token">Admin API Token</option>
              <option value="client_credentials">Client ID + Client Secret</option>
              <option value="oauth">Connect Shopify (OAuth Install)</option>
            </select>
            <input
              value={shopifyStoreDomain}
              onChange={(e) => setShopifyStoreDomain(e.target.value)}
              placeholder="Store domain (example: yourstore.myshopify.com)"
            />
            <input
              value={shopifyApiVersion}
              onChange={(e) => setShopifyApiVersion(e.target.value)}
              placeholder="API version (example: 2024-10)"
            />
            {shopifyMode === "admin_token" ? (
              <input
                type="password"
                value={shopifyAccessToken}
                onChange={(e) => setShopifyAccessToken(e.target.value)}
                placeholder={shopifyMaskedToken ? `Access token (${shopifyMaskedToken})` : "Admin API access token"}
              />
            ) : shopifyMode === "client_credentials" ? (
              <>
                <input
                  value={shopifyClientId}
                  onChange={(e) => setShopifyClientId(e.target.value)}
                  placeholder="Client ID"
                />
                <input
                  type="password"
                  value={shopifyClientSecret}
                  onChange={(e) => setShopifyClientSecret(e.target.value)}
                  placeholder={
                    shopifyMaskedClientSecret
                      ? `Client Secret (${shopifyMaskedClientSecret})`
                      : "Client Secret"
                  }
                />
              </>
            ) : (
              <small>
                OAuth mode uses app installation and secure token exchange. Click Connect Shopify to continue.
              </small>
            )}
            {shopifyMode === "oauth" ? (
              <button className="secondary" onClick={connectShopifyOAuth}>
                Connect Shopify
              </button>
            ) : (
              <button className="secondary" onClick={saveShopifyConnection}>
                Save & Test Shopify Connection
              </button>
            )}
            <small>
              Status: {shopifyConnected ? `Connected ${shopName ? `(${shopName})` : ""}` : "Not connected"}
            </small>
            {shopifyHint && <small style={{ color: "#ffd7b5" }}>Hint: {shopifyHint}</small>}
          </div>

          {shopifyConnected && (
            <div className="admin__form" style={{ marginBottom: "1rem" }}>
              <h3>Shopify Diagnostics</h3>
              <small>Granted scopes for current token:</small>
              {grantedScopes.length > 0 ? (
                <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", marginTop: "0.5rem" }}>
                  {grantedScopes.map((scope) => (
                    <span
                      key={scope}
                      style={{
                        fontSize: "0.8rem",
                        padding: "0.3rem 0.6rem",
                        borderRadius: "999px",
                        border: "1px solid rgba(255,255,255,0.25)",
                        background: "rgba(255,255,255,0.06)",
                      }}
                    >
                      {scope}
                    </span>
                  ))}
                </div>
              ) : (
                <small style={{ color: "#ffd7b5" }}>
                  No scopes returned yet. Reconnect Shopify to refresh.
                </small>
              )}
              {scopeError && <small style={{ color: "#ffd7b5" }}>{scopeError}</small>}
            </div>
          )}

          <div className="admin__grid">
            <div className="admin__item"><strong>Categories</strong><small>{collections.length}</small></div>
            <div className="admin__item"><strong>Brands</strong><small>{brands.length}</small></div>
            <div className="admin__item"><strong>Vendors</strong><small>{vendors.length}</small></div>
            <div className="admin__item"><strong>Products</strong><small>{products.length}</small></div>
          </div>
          <p className="hero__subtext" style={{ marginTop: "1rem" }}>
            Last synced: {syncedAt ? new Date(syncedAt).toLocaleString() : "Never"}
          </p>
          <div className="admin__sync-badge">{syncBadge}</div>
          <div className="admin__form" style={{ marginBottom: "1rem" }}>
            <h3>Sync Scheduler</h3>
            <select
              value={schedulerMode}
              onChange={(e) => setSchedulerMode(e.target.value as SchedulerMode)}
            >
              <option value="manual">Manual only</option>
              <option value="hourly">Hourly auto-sync</option>
            </select>
            <button className="secondary" onClick={saveSchedulerMode}>
              Save Scheduler
            </button>
            <small>
              Manual: sync only when you click button. Hourly: auto-refreshes data every hour.
            </small>
          </div>
          <div className="admin__form" style={{ marginBottom: "1rem" }}>
            <h3>Shopify Commerce Modules (2-way sync visibility)</h3>
            <label style={{ display: "flex", alignItems: "center", gap: "0.55rem" }}>
              <input
                type="checkbox"
                checked={commerceConfig.enablePayments}
                onChange={(e) =>
                  setCommerceConfig((prev) => ({ ...prev, enablePayments: e.target.checked }))
                }
              />
              Payments
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: "0.55rem" }}>
              <input
                type="checkbox"
                checked={commerceConfig.enableCheckout}
                onChange={(e) =>
                  setCommerceConfig((prev) => ({ ...prev, enableCheckout: e.target.checked }))
                }
              />
              Checkout
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: "0.55rem" }}>
              <input
                type="checkbox"
                checked={commerceConfig.enableCustomerAccounts}
                onChange={(e) =>
                  setCommerceConfig((prev) => ({
                    ...prev,
                    enableCustomerAccounts: e.target.checked,
                  }))
                }
              />
              Customer accounts
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: "0.55rem" }}>
              <input
                type="checkbox"
                checked={commerceConfig.enableShippingDelivery}
                onChange={(e) =>
                  setCommerceConfig((prev) => ({
                    ...prev,
                    enableShippingDelivery: e.target.checked,
                  }))
                }
              />
              Shipping and delivery
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: "0.55rem" }}>
              <input
                type="checkbox"
                checked={commerceConfig.enableTaxesDuties}
                onChange={(e) =>
                  setCommerceConfig((prev) => ({ ...prev, enableTaxesDuties: e.target.checked }))
                }
              />
              Taxes and duties
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: "0.55rem" }}>
              <input
                type="checkbox"
                checked={commerceConfig.enableInventoryStock}
                onChange={(e) =>
                  setCommerceConfig((prev) => ({
                    ...prev,
                    enableInventoryStock: e.target.checked,
                  }))
                }
              />
              Inventory and stock visibility
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: "0.55rem" }}>
              <input
                type="checkbox"
                checked={commerceConfig.enableNotifications}
                onChange={(e) =>
                  setCommerceConfig((prev) => ({
                    ...prev,
                    enableNotifications: e.target.checked,
                  }))
                }
              />
              Notifications
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: "0.55rem" }}>
              <input
                type="checkbox"
                checked={commerceConfig.enableCustomerPolicy}
                onChange={(e) =>
                  setCommerceConfig((prev) => ({
                    ...prev,
                    enableCustomerPolicy: e.target.checked,
                  }))
                }
              />
              Customer policy visibility
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: "0.55rem" }}>
              <input
                type="checkbox"
                checked={commerceConfig.enableTwoWaySync}
                onChange={(e) =>
                  setCommerceConfig((prev) => ({ ...prev, enableTwoWaySync: e.target.checked }))
                }
              />
              Enforce two-way sync mode
            </label>
            <input
              value={commerceConfig.notificationEmail}
              onChange={(e) =>
                setCommerceConfig((prev) => ({ ...prev, notificationEmail: e.target.value }))
              }
              placeholder="Commerce notifications email"
            />
            <input
              type="number"
              value={commerceConfig.taxRatePct}
              onChange={(e) =>
                setCommerceConfig((prev) => ({ ...prev, taxRatePct: Number(e.target.value || 0) }))
              }
              placeholder="Tax rate %"
            />
            <input
              type="number"
              value={commerceConfig.shippingFlatRate}
              onChange={(e) =>
                setCommerceConfig((prev) => ({
                  ...prev,
                  shippingFlatRate: Number(e.target.value || 0),
                }))
              }
              placeholder="Flat shipping amount"
            />
            <textarea
              rows={2}
              value={commerceConfig.shippingPolicy}
              onChange={(e) =>
                setCommerceConfig((prev) => ({ ...prev, shippingPolicy: e.target.value }))
              }
              placeholder="Shipping policy"
            />
            <textarea
              rows={2}
              value={commerceConfig.returnsPolicy}
              onChange={(e) =>
                setCommerceConfig((prev) => ({ ...prev, returnsPolicy: e.target.value }))
              }
              placeholder="Returns policy"
            />
            <textarea
              rows={2}
              value={commerceConfig.warrantyPolicy}
              onChange={(e) =>
                setCommerceConfig((prev) => ({ ...prev, warrantyPolicy: e.target.value }))
              }
              placeholder="Warranty policy"
            />
            <textarea
              rows={2}
              value={commerceConfig.privacyPolicy}
              onChange={(e) =>
                setCommerceConfig((prev) => ({ ...prev, privacyPolicy: e.target.value }))
              }
              placeholder="Privacy policy"
            />
            <button className="secondary" onClick={saveCommerceConfig}>
              Save Commerce Modules Config
            </button>
          </div>
          <button className="primary" onClick={syncNow}>Sync from Shopify (Manual Now)</button>

          <hr style={{ borderColor: "rgba(255,255,255,0.12)", margin: "1.5rem 0" }} />

          <h3>Email Integration (Contact + Bulk Notifications)</h3>
          <div className="admin__form" style={{ marginBottom: "1rem" }}>
            <input
              value={enquirySettings.mailTo}
              onChange={(e) =>
                setEnquirySettings((prev) => ({ ...prev, mailTo: e.target.value }))
              }
              placeholder="Notification recipient email"
            />
            <input
              value={enquirySettings.smtpHost}
              onChange={(e) =>
                setEnquirySettings((prev) => ({ ...prev, smtpHost: e.target.value }))
              }
              placeholder="SMTP host (example: smtp.gmail.com)"
            />
            <input
              value={enquirySettings.smtpPort}
              onChange={(e) =>
                setEnquirySettings((prev) => ({ ...prev, smtpPort: e.target.value }))
              }
              placeholder="SMTP port (example: 587)"
            />
            <input
              value={enquirySettings.smtpUser}
              onChange={(e) =>
                setEnquirySettings((prev) => ({ ...prev, smtpUser: e.target.value }))
              }
              placeholder="SMTP username/email"
            />
            <input
              type="password"
              value={enquirySettings.smtpPass}
              onChange={(e) =>
                setEnquirySettings((prev) => ({ ...prev, smtpPass: e.target.value }))
              }
              placeholder={
                enquirySettings.maskedSmtpPass
                  ? `SMTP password (${enquirySettings.maskedSmtpPass})`
                  : "SMTP password"
              }
            />
            <input
              value={enquirySettings.smtpFrom}
              onChange={(e) =>
                setEnquirySettings((prev) => ({ ...prev, smtpFrom: e.target.value }))
              }
              placeholder="From email (optional)"
            />
            <button className="secondary" onClick={saveEnquirySettings}>
              Save Email Integration
            </button>
            <small>
              This controls where Contact Us and Bulk Orders enquiry notifications are sent.
            </small>
          </div>

          <hr style={{ borderColor: "rgba(255,255,255,0.12)", margin: "1.5rem 0" }} />

          <h3>Login Methods Settings</h3>
          <div className="admin__form" style={{ marginBottom: "1rem" }}>
            <label style={{ display: "flex", alignItems: "center", gap: "0.55rem" }}>
              <input
                type="checkbox"
                checked={authSettings.enableEmailPasswordLogin}
                onChange={(e) =>
                  setAuthSettings((prev) => ({ ...prev, enableEmailPasswordLogin: e.target.checked }))
                }
              />
              Enable Email + Password only login
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: "0.55rem" }}>
              <input
                type="checkbox"
                checked={authSettings.enableEmailCodeLogin}
                onChange={(e) =>
                  setAuthSettings((prev) => ({ ...prev, enableEmailCodeLogin: e.target.checked }))
                }
              />
              Enable Email + Password + Verification Code login
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: "0.55rem" }}>
              <input
                type="checkbox"
                checked={authSettings.enableGoogleLogin}
                onChange={(e) =>
                  setAuthSettings((prev) => ({ ...prev, enableGoogleLogin: e.target.checked }))
                }
              />
              Enable Google Sign-In
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: "0.55rem" }}>
              <input
                type="checkbox"
                checked={authSettings.enableMobileOtpLogin}
                onChange={(e) =>
                  setAuthSettings((prev) => ({ ...prev, enableMobileOtpLogin: e.target.checked }))
                }
              />
              Enable Mobile OTP login (Twilio Verify)
            </label>
            <input
              value={authSettings.googleClientId}
              onChange={(e) =>
                setAuthSettings((prev) => ({ ...prev, googleClientId: e.target.value }))
              }
              placeholder="Google OAuth Client ID"
            />
            <input
              type="password"
              value={authSettings.googleClientSecret}
              onChange={(e) =>
                setAuthSettings((prev) => ({ ...prev, googleClientSecret: e.target.value }))
              }
              placeholder={
                authSettings.maskedGoogleClientSecret
                  ? `Google OAuth Client Secret (${authSettings.maskedGoogleClientSecret})`
                  : "Google OAuth Client Secret"
              }
            />
            <input
              value={authSettings.googleRedirectUri}
              onChange={(e) =>
                setAuthSettings((prev) => ({ ...prev, googleRedirectUri: e.target.value }))
              }
              placeholder="Google Redirect URI (optional)"
            />
            <input
              value={authSettings.twilioAccountSid}
              onChange={(e) =>
                setAuthSettings((prev) => ({ ...prev, twilioAccountSid: e.target.value }))
              }
              placeholder="Twilio Account SID"
            />
            <input
              type="password"
              value={authSettings.twilioAuthToken}
              onChange={(e) =>
                setAuthSettings((prev) => ({ ...prev, twilioAuthToken: e.target.value }))
              }
              placeholder={
                authSettings.maskedTwilioAuthToken
                  ? `Twilio Auth Token (${authSettings.maskedTwilioAuthToken})`
                  : "Twilio Auth Token"
              }
            />
            <input
              value={authSettings.twilioVerifyServiceSid}
              onChange={(e) =>
                setAuthSettings((prev) => ({ ...prev, twilioVerifyServiceSid: e.target.value }))
              }
              placeholder="Twilio Verify Service SID"
            />
            <button className="secondary" onClick={saveAuthSettings}>
              Save Login Methods
            </button>
            <button className="secondary" onClick={testTwilioCredentials} disabled={testingTwilio}>
              {testingTwilio ? "Testing Twilio..." : "Test Twilio Credentials"}
            </button>
            <small>
              Email code login uses the SMTP settings above. Leave redirect URI blank to use
              /api/auth/google/callback on current domain. Mobile OTP uses Twilio Verify service
              credentials above.
            </small>
          </div>

          <hr style={{ borderColor: "rgba(255,255,255,0.12)", margin: "1.5rem 0" }} />

          <h3>Update Shopify Product</h3>
          <div className="admin__form">
            <select value={selectedProductId} onChange={(e) => setSelectedProductId(e.target.value)}>
              <option value="">Select product</option>
              {products.map((product) => (
                <option key={product.id} value={product.id}>{product.title}</option>
              ))}
            </select>
            <input value={productTitle} onChange={(e) => setProductTitle(e.target.value)} placeholder="Product title" />
            <input value={productTags} onChange={(e) => setProductTags(e.target.value)} placeholder="Tags (comma separated)" />
            <select value={productStatus} onChange={(e) => setProductStatus(e.target.value)}>
              <option value="">Select status</option>
              <option value="active">active</option>
              <option value="draft">draft</option>
              <option value="archived">archived</option>
            </select>
            <button className="secondary" onClick={updateShopifyProduct}>Update Product</button>
          </div>

          <hr style={{ borderColor: "rgba(255,255,255,0.12)", margin: "1.5rem 0" }} />

          <h3>Update Shopify Collection</h3>
          <div className="admin__form">
            <select value={selectedCollectionId} onChange={(e) => setSelectedCollectionId(e.target.value)}>
              <option value="">Select collection</option>
              {collections.map((collection) => (
                <option key={collection.id} value={collection.id}>{collection.title}</option>
              ))}
            </select>
            <input value={collectionTitle} onChange={(e) => setCollectionTitle(e.target.value)} placeholder="Collection title" />
            <textarea rows={4} value={collectionDescription} onChange={(e) => setCollectionDescription(e.target.value)} placeholder="Collection description (HTML allowed)" />
            <button className="secondary" onClick={updateShopifyCollection}>Update Collection</button>
          </div>
        </div>
        )}

        {activeTab === "pages" && (
        <div className="admin__panel">
          <h2>Editable Site Pages</h2>
          <p className="hero__subtext">
            Elementor-style theme builder: add, reorder, and edit blocks for each site page.
          </p>

          <div className="admin__form" style={{ marginBottom: "1rem" }}>
            <h3>Global Text Fields</h3>
            <select
              value={siteContent.themeMode}
              onChange={(e) =>
                setSiteContent((prev) => ({
                  ...prev,
                  themeMode: e.target.value as SiteThemeMode,
                }))
              }
            >
              <option value="dark">Dark Theme (Black background / White text)</option>
              <option value="light">Light Theme (White background / Black text)</option>
            </select>
            <input
              value={siteContent.home.title}
              onChange={(e) =>
                setSiteContent((prev) =>
                  syncHomeHeroWithGlobal(prev, {
                    ...prev.home,
                    title: e.target.value,
                  })
                )
              }
              placeholder="Home title"
            />
            <textarea
              rows={3}
              value={siteContent.home.subtitle}
              onChange={(e) =>
                setSiteContent((prev) =>
                  syncHomeHeroWithGlobal(prev, {
                    ...prev.home,
                    subtitle: e.target.value,
                  })
                )
              }
              placeholder="Home subtitle"
            />
            <input
              value={siteContent.home.heroImageUrl}
              onChange={(e) =>
                setSiteContent((prev) => ({
                  ...prev,
                  home: { ...prev.home, heroImageUrl: e.target.value },
                }))
              }
              placeholder="Home hero image URL"
            />
            <input
              type="file"
              accept="image/*"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void uploadHeroImage(file);
                e.currentTarget.value = "";
              }}
            />
            {uploadingHeroImage ? <small>Uploading hero image...</small> : null}
            {siteContent.home.heroImageUrl ? (
              <div className="admin__image-preview-wrap">
                <div className="admin__image-preview">
                  <img src={siteContent.home.heroImageUrl} alt="Hero preview" />
                </div>
                <button
                  type="button"
                  className="ghost admin__image-remove"
                  onClick={() =>
                    setSiteContent((prev) => ({
                      ...prev,
                      home: { ...prev.home, heroImageUrl: "" },
                    }))
                  }
                >
                  Remove image
                </button>
              </div>
            ) : null}
            <input
              value={siteContent.home.programsImageUrl || ""}
              onChange={(e) =>
                setSiteContent((prev) => ({
                  ...prev,
                  home: { ...prev.home, programsImageUrl: e.target.value },
                }))
              }
              placeholder="Programs section image URL"
            />
            <input
              type="file"
              accept="image/*"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void uploadProgramsImage(file);
                e.currentTarget.value = "";
              }}
            />
            {uploadingProgramsImage ? <small>Uploading programs image...</small> : null}
            {siteContent.home.programsImageUrl ? (
              <div className="admin__image-preview-wrap">
                <div className="admin__image-preview">
                  <img src={siteContent.home.programsImageUrl} alt="Programs section preview" />
                </div>
                <button
                  type="button"
                  className="ghost admin__image-remove"
                  onClick={() =>
                    setSiteContent((prev) => ({
                      ...prev,
                      home: { ...prev.home, programsImageUrl: "" },
                    }))
                  }
                >
                  Remove image
                </button>
              </div>
            ) : null}
            <textarea
              rows={3}
              value={siteContent.contactUs}
              onChange={(e) => setSiteContent((prev) => ({ ...prev, contactUs: e.target.value }))}
              placeholder="Contact Us summary"
            />
            <textarea
              rows={3}
              value={siteContent.aboutUs}
              onChange={(e) => setSiteContent((prev) => ({ ...prev, aboutUs: e.target.value }))}
              placeholder="About Us summary"
            />
            <textarea
              rows={3}
              value={siteContent.partners}
              onChange={(e) => setSiteContent((prev) => ({ ...prev, partners: e.target.value }))}
              placeholder="Partners summary"
            />
            <textarea
              rows={3}
              value={siteContent.storeLocator}
              onChange={(e) => setSiteContent((prev) => ({ ...prev, storeLocator: e.target.value }))}
              placeholder="Store Locator summary"
            />
          </div>

          <div className="admin__form" style={{ marginBottom: "1rem" }}>
            <h3>Theme Builder Blocks</h3>
            <select
              value={selectedBuilderPage}
              onChange={(e) => setSelectedBuilderPage(e.target.value as SitePageKey)}
            >
              {SITE_PAGE_OPTIONS.map((option) => (
                <option key={option.key} value={option.key}>
                  {option.label}
                </option>
              ))}
            </select>

            <div className="admin__builder-actions">
              <button className="secondary" type="button" onClick={() => addBlock(selectedBuilderPage, "hero")}>
                + Hero Block
              </button>
              <button className="secondary" type="button" onClick={() => addBlock(selectedBuilderPage, "text")}>
                + Text Block
              </button>
              <button
                className="secondary"
                type="button"
                onClick={() => addBlock(selectedBuilderPage, "featureGrid")}
              >
                + Feature Grid
              </button>
            </div>

            <div className="admin__builder-list">
              {getBlocks(selectedBuilderPage).length ? (
                getBlocks(selectedBuilderPage).map((block, blockIndex) => (
                  <div className="admin__builder-card" key={block.id}>
                    <div className="admin__builder-card-top">
                      <strong>
                        Block {blockIndex + 1}: {block.type}
                      </strong>
                      <div className="admin__builder-controls">
                        <button type="button" className="ghost" onClick={() => moveBlock(selectedBuilderPage, block.id, -1)}>
                          ?
                        </button>
                        <button type="button" className="ghost" onClick={() => moveBlock(selectedBuilderPage, block.id, 1)}>
                          ?
                        </button>
                        <button type="button" className="ghost" onClick={() => deleteBlock(selectedBuilderPage, block.id)}>
                          Delete
                        </button>
                      </div>
                    </div>

                    <select
                      value={block.type}
                      onChange={(e) => updateBlock(selectedBuilderPage, block.id, { type: e.target.value as SitePageBlock["type"] })}
                    >
                      <option value="hero">Hero</option>
                      <option value="text">Text</option>
                      <option value="featureGrid">Feature Grid</option>
                    </select>
                    <select
                      value={block.theme}
                      onChange={(e) => updateBlock(selectedBuilderPage, block.id, { theme: e.target.value as "light" | "dark" })}
                    >
                      <option value="dark">Dark section</option>
                      <option value="light">Light section</option>
                    </select>
                    <input
                      value={block.eyebrow || ""}
                      onChange={(e) => updateBlock(selectedBuilderPage, block.id, { eyebrow: e.target.value })}
                      placeholder="Eyebrow (optional)"
                    />
                    <input
                      value={block.title || ""}
                      onChange={(e) => updateBlock(selectedBuilderPage, block.id, { title: e.target.value })}
                      placeholder="Title"
                    />
                    <textarea
                      rows={3}
                      value={block.content || ""}
                      onChange={(e) => updateBlock(selectedBuilderPage, block.id, { content: e.target.value })}
                      placeholder="Content"
                    />

                    {(block.type === "hero" || block.type === "text") && (
                      <>
                        <input
                          value={block.ctaLabel || ""}
                          onChange={(e) => updateBlock(selectedBuilderPage, block.id, { ctaLabel: e.target.value })}
                          placeholder="CTA label (optional)"
                        />
                        <input
                          value={block.ctaHref || ""}
                          onChange={(e) => updateBlock(selectedBuilderPage, block.id, { ctaHref: e.target.value })}
                          placeholder="CTA link (optional)"
                        />
                      </>
                    )}

                    {block.type === "featureGrid" && (
                      <div className="admin__builder-items">
                        <strong>Grid Items</strong>
                        {(block.items || []).map((item) => (
                          <div key={item.id} className="admin__builder-item">
                            <input
                              value={item.title}
                              onChange={(e) =>
                                updateFeatureItem(selectedBuilderPage, block.id, item.id, {
                                  title: e.target.value,
                                })
                              }
                              placeholder="Item title"
                            />
                            <textarea
                              rows={2}
                              value={item.description}
                              onChange={(e) =>
                                updateFeatureItem(selectedBuilderPage, block.id, item.id, {
                                  description: e.target.value,
                                })
                              }
                              placeholder="Item description"
                            />
                            <button
                              type="button"
                              className="ghost"
                              onClick={() => removeFeatureItem(selectedBuilderPage, block.id, item.id)}
                            >
                              Remove item
                            </button>
                          </div>
                        ))}
                        <button type="button" className="secondary" onClick={() => addFeatureItem(selectedBuilderPage, block.id)}>
                          + Add grid item
                        </button>
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <small>No blocks yet for this page. Add a block to start building.</small>
              )}
            </div>
          </div>
          <button className="primary" onClick={savePages}>Save Site Pages</button>
        </div>
        )}
      </div>
    </div>
  );
}


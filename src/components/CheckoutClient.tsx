"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { CatalogProduct } from "@/lib/catalog";
import { clearCartInStorage, getCartItemsFromStorage, type CartItem } from "@/lib/cart";
import { isAllowedInvoiceUrl } from "@/lib/payment";
import { readJsonSafe } from "@/lib/httpClient";

type Variant = NonNullable<CatalogProduct["variants"]>[number];
type PaymentGateway = "manual" | "razorpay" | "payu" | "cod";
type AddressSuggestion = {
  label: string;
  lat: string;
  lng: string;
  street: string;
  area: string;
  city: string;
  state: string;
  pincode: string;
};

type RazorpayOptions = {
  key: string;
  amount: number;
  currency: string;
  name?: string;
  description?: string;
  order_id: string;
  prefill?: { email?: string };
  notes?: Record<string, string>;
  handler: (response: {
    razorpay_payment_id: string;
    razorpay_order_id: string;
    razorpay_signature: string;
  }) => void;
  modal?: {
    ondismiss?: () => void;
  };
};

declare global {
  interface Window {
    Razorpay?: new (options: RazorpayOptions) => { open: () => void };
  }
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

function normalizeCheckoutEmail(value: string): string {
  const raw = value.trim().toLowerCase();
  if (!raw) return raw;
  if (raw.endsWith("@pcgs.local") || raw.endsWith(".local")) {
    const mobileMatch = raw.match(/^mobile(\d{10,15})@/i);
    if (mobileMatch?.[1]) {
      return `mobile${mobileMatch[1]}@revampfy.in`;
    }
  }
  return raw;
}

function toPaymentsHostUrl(invoiceUrl: string): string {
  try {
    const parsed = new URL(invoiceUrl);
    parsed.protocol = "https:";
    parsed.host = "payments.revampfy.in";
    return parsed.toString();
  } catch {
    return "https://payments.revampfy.in/";
  }
}

const PENDING_PAYMENT_KEY = "revampfy_pending_checkout_payment";
const FORCE_RELOAD_ON_RETURN_KEY = "revampfy_checkout_force_reload";
const RETURN_RELOAD_DONE_KEY = "revampfy_checkout_return_reload_done";

type PendingCheckoutPayment = {
  startedAt?: number;
  checkoutUrl?: string;
  invoiceUrl?: string;
  draftOrderId?: number;
  orderRef?: string;
};

function readPendingPayment(): PendingCheckoutPayment | null {
  try {
    const raw = window.sessionStorage.getItem(PENDING_PAYMENT_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as PendingCheckoutPayment;
  } catch {
    return null;
  }
}

export function CheckoutClient() {
  const params = useSearchParams();
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [placingOrder, setPlacingOrder] = useState(false);
  const [email, setEmail] = useState("");
  const [mobile, setMobile] = useState("");
  const [address, setAddress] = useState("");
  const [street, setStreet] = useState("");
  const [area, setArea] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [pincode, setPincode] = useState("");
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [paymentGateway, setPaymentGateway] = useState<PaymentGateway>("manual");
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<PaymentGateway>("manual");
  const [enableCod, setEnableCod] = useState(true);
  const [requireGpsForCod, setRequireGpsForCod] = useState(true);
  const [requireGpsForAllPayments, setRequireGpsForAllPayments] = useState(true);
  const [payuEnabled, setPayuEnabled] = useState(false);
  const [razorpayEnabled, setRazorpayEnabled] = useState(false);
  const [razorpayKeyId, setRazorpayKeyId] = useState("");
  const [locationLat, setLocationLat] = useState("");
  const [locationLng, setLocationLng] = useState("");
  const [addressSuggestions, setAddressSuggestions] = useState<AddressSuggestion[]>([]);
  const [searchingAddress, setSearchingAddress] = useState(false);
  const [selectedAddressLabel, setSelectedAddressLabel] = useState("");
  const [showAddressSuggestions, setShowAddressSuggestions] = useState(false);
  const loadingRef = useRef(false);
  const checkingReturnRef = useRef(false);

  const productId = Number(params.get("productId") || "");
  const variantId = Number(params.get("variantId") || "");
  const quantity = Math.max(1, Number(params.get("qty") || "1"));
  const isCartCheckout = params.get("cart") === "1";
  const paymentStatus = (params.get("paymentStatus") || "").toLowerCase();

  const loadData = useCallback(async () => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    let done = false;
    const fetchWithTimeout = async (url: string, init?: RequestInit, timeoutMs = 10000) => {
      const controller = new AbortController();
      const timer = window.setTimeout(() => controller.abort(), timeoutMs);
      try {
        return await fetch(url, { ...(init || {}), signal: controller.signal });
      } finally {
        window.clearTimeout(timer);
      }
    };

    setLoading(true);
    setError("");
      const watchdog = window.setTimeout(() => {
        if (done) return;
        loadingRef.current = false;
        setLoading(false);
        setError("Checkout loading timed out. Please tap Retry.");
      }, 12000);
    try {
      const [sessionResult, syncResult, paymentResult] = await Promise.allSettled([
        fetchWithTimeout("/api/auth/session"),
        fetchWithTimeout("/api/catalog/sync"),
        fetchWithTimeout("/api/commerce/payment-config", { cache: "no-store" }),
      ]);
      if (sessionResult.status === "fulfilled") {
        const sessionJson = await readJsonSafe(sessionResult.value);
        if (sessionJson?.session?.email) {
          setEmail(normalizeCheckoutEmail(String(sessionJson.session.email)));
        }
      }
      try {
        const profileRes = await fetchWithTimeout("/api/auth/profile", { cache: "no-store" }, 8000);
        const profileJson = await readJsonSafe(profileRes);
        if (profileRes.ok && profileJson?.profile) {
          setMobile(String(profileJson.profile.mobile || ""));
          setAddress(String(profileJson.profile.address || ""));
          setStreet(String(profileJson.profile.street || ""));
          setArea(String(profileJson.profile.area || ""));
          setCity(String(profileJson.profile.city || ""));
          setState(String(profileJson.profile.state || ""));
          setPincode(String(profileJson.profile.pincode || ""));
        }
      } catch {
        // ignore profile prefill failures
      }

      let loadedProducts: CatalogProduct[] = [];
      if (syncResult.status === "fulfilled") {
        const syncJson = await readJsonSafe(syncResult.value);
        loadedProducts = Array.isArray(syncJson?.payload?.products) ? syncJson.payload.products : [];
      }
      if (!loadedProducts.length && Number.isFinite(productId) && productId > 0) {
        try {
          const productRes = await fetchWithTimeout(`/api/catalog/products/${productId}`, undefined, 8000);
          const productJson = await readJsonSafe(productRes);
          if (productRes.ok && productJson?.product) {
            loadedProducts = [productJson.product as CatalogProduct];
          }
        } catch {
          // ignore fallback fetch errors
        }
      }
      setProducts(loadedProducts);
      setCartItems(getCartItemsFromStorage());
      if (paymentResult.status === "fulfilled") {
        const paymentJson = await readJsonSafe(paymentResult.value);
        const gateway =
          paymentJson?.paymentGateway === "razorpay" ||
          paymentJson?.paymentGateway === "payu" ||
          paymentJson?.paymentGateway === "cod"
            ? paymentJson.paymentGateway
            : "manual";
        setPaymentGateway(gateway);
        setSelectedPaymentMethod(gateway);
        setEnableCod(Boolean(paymentJson?.enableCod ?? true));
        setRequireGpsForCod(Boolean(paymentJson?.requireGpsForCod ?? true));
        setRequireGpsForAllPayments(Boolean(paymentJson?.requireGpsForAllPayments ?? true));
        setPayuEnabled(Boolean(paymentJson?.payuEnabled ?? false));
        setRazorpayEnabled(Boolean(paymentJson?.razorpayEnabled ?? false));
        setRazorpayKeyId(String(paymentJson?.razorpayKeyId || ""));
      } else {
        setPaymentGateway("manual");
        setSelectedPaymentMethod("manual");
        setRazorpayKeyId("");
        setRazorpayEnabled(false);
        setPayuEnabled(false);
      }
    } catch {
      setError("Could not load checkout details. Please refresh or retry.");
    } finally {
      done = true;
      loadingRef.current = false;
      window.clearTimeout(watchdog);
      setLoading(false);
    }
  }, [productId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    const checkPendingDraftStatus = async () => {
      if (checkingReturnRef.current) return;
      const pending = readPendingPayment();
      if (!pending?.draftOrderId) return;
      checkingReturnRef.current = true;
      try {
        const response = await fetch(
          `/api/catalog/draft-orders/status?draftOrderId=${encodeURIComponent(String(pending.draftOrderId))}`,
          { cache: "no-store" }
        );
        const json = await readJsonSafe(response);
        const status = String(json?.status || "").toLowerCase();
        const completed = Boolean(json?.completed) || status === "completed";
        if (completed) {
          window.sessionStorage.removeItem(PENDING_PAYMENT_KEY);
          window.sessionStorage.removeItem(RETURN_RELOAD_DONE_KEY);
          window.location.href = "/user-dashboard?payment=success";
          return;
        }
      } catch {
        // ignore status check failures; normal fallback will apply
      } finally {
        checkingReturnRef.current = false;
      }
    };

    const onPageShow = (event: PageTransitionEvent) => {
      document.body.style.overflow = "";
      try {
        const shouldForceReload = window.sessionStorage.getItem(FORCE_RELOAD_ON_RETURN_KEY) === "1";
        if (event.persisted && shouldForceReload) {
          window.sessionStorage.removeItem(FORCE_RELOAD_ON_RETURN_KEY);
          window.location.reload();
          return;
        }
        const pending = readPendingPayment();
        const referrer = document.referrer || "";
        const returnedFromPaymentHost =
          referrer.includes("payments.revampfy.in/checkouts") ||
          referrer.includes(".myCatalog.com/") ||
          referrer.includes("/invoices/");
        const navEntry = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
        const returnedByHistory = Boolean(event.persisted) || navEntry?.type === "back_forward";
        if (pending && (returnedFromPaymentHost || returnedByHistory)) {
          void checkPendingDraftStatus();
          const reloadedOnce = window.sessionStorage.getItem(RETURN_RELOAD_DONE_KEY) === "1";
          if (!reloadedOnce) {
            window.sessionStorage.setItem(RETURN_RELOAD_DONE_KEY, "1");
            window.location.reload();
            return;
          }
          window.sessionStorage.removeItem(RETURN_RELOAD_DONE_KEY);
          window.sessionStorage.removeItem(PENDING_PAYMENT_KEY);
          setMessage("");
          setError("Payment failed, Try again.");
        }
      } catch {
        window.sessionStorage.removeItem(PENDING_PAYMENT_KEY);
        window.sessionStorage.removeItem(RETURN_RELOAD_DONE_KEY);
      }
      if (!loadingRef.current) void loadData();
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        document.body.style.overflow = "";
        const pending = readPendingPayment();
        if (pending && !paymentStatus) {
          void checkPendingDraftStatus();
          const pendingAge = Date.now() - Number(pending.startedAt || 0);
          if (pendingAge > 5000) {
            window.sessionStorage.removeItem(PENDING_PAYMENT_KEY);
            window.sessionStorage.removeItem(RETURN_RELOAD_DONE_KEY);
            setMessage("");
            setError("Payment failed, Try again.");
          }
        }
        if (!loadingRef.current) void loadData();
      }
    };
    window.addEventListener("pageshow", onPageShow);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("pageshow", onPageShow);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [loadData, paymentStatus]);

  useEffect(() => {
    if (!loading) return;
    const hardStop = window.setTimeout(() => {
      loadingRef.current = false;
      setLoading(false);
      setError((prev) => prev || "Checkout is taking too long. Please tap Retry.");
    }, 16000);
    return () => window.clearTimeout(hardStop);
  }, [loading]);

  useEffect(() => {
    if (paymentStatus === "success") {
      setMessage("Order placed successfully.");
      setError("");
      window.sessionStorage.removeItem(PENDING_PAYMENT_KEY);
      window.sessionStorage.removeItem(RETURN_RELOAD_DONE_KEY);
      const timer = window.setTimeout(() => {
        window.location.href = "/user-dashboard?payment=success";
      }, 350);
      return () => window.clearTimeout(timer);
    }
    if (paymentStatus === "cancelled") {
      setError("Payment cancelled. You can retry whenever ready.");
      setMessage("");
      window.sessionStorage.removeItem(PENDING_PAYMENT_KEY);
      window.sessionStorage.removeItem(RETURN_RELOAD_DONE_KEY);
      return;
    }
    if (paymentStatus === "failed") {
      setError("Payment failed, Try again.");
      setMessage("");
      window.sessionStorage.removeItem(PENDING_PAYMENT_KEY);
      window.sessionStorage.removeItem(RETURN_RELOAD_DONE_KEY);
    }
  }, [paymentStatus]);

  const selected = useMemo(() => {
    const product = products.find((item) => item.id === productId);
    if (!product) return null;
    const variant = (product.variants || []).find((item) => item.id === variantId) as
      | Variant
      | undefined;
    if (!variant) return null;
    return { product, variant };
  }, [products, productId, variantId]);

  const total = useMemo(() => {
    if (isCartCheckout) {
      return cartItems.reduce((sum, item) => sum + Number(item.price || 0) * item.quantity, 0);
    }
    return selected ? Number(selected.variant.price || 0) * quantity : 0;
  }, [selected, quantity, isCartCheckout, cartItems]);

  const placeOrder = async () => {
    setError("");
    setMessage("");
    const safeEmail = normalizeCheckoutEmail(email);
    if (!safeEmail) {
      setError("Email is required.");
      return;
    }
    if (safeEmail !== email) {
      setEmail(safeEmail);
    }
    const safeMobile = String(mobile || "").trim();
    const safeAddress = String(address || "").trim();
    if (!safeMobile) {
      setError("Mobile number is required.");
      return;
    }
    if (!safeAddress) {
      setError("Address is required.");
      return;
    }
    if (selectedPaymentMethod === "cod" && !enableCod) {
      setError("COD is disabled by admin.");
      return;
    }
    if (!street.trim() || !area.trim() || !city.trim() || !state.trim() || !pincode.trim()) {
      setError("Street, area, city, state, and pincode are required.");
      return;
    }
    if ((requireGpsForAllPayments || (selectedPaymentMethod === "cod" && requireGpsForCod)) && (!locationLat || !locationLng)) {
      setError("Exact GPS location is required for all payment methods.");
      return;
    }

    setPlacingOrder(true);
    let managedByRazorpay = false;
    try {
      const lineItems = isCartCheckout
        ? cartItems.map((item) => ({ variantId: item.variantId, quantity: item.quantity }))
        : selected
          ? [{ variantId: selected.variant.id, quantity }]
          : [];

      if (!lineItems.length) {
        setError("No checkout items found.");
        return;
      }
      await fetch("/api/auth/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: safeEmail,
          mobile: safeMobile,
          address: safeAddress,
          street: String(street || "").trim(),
          area: String(area || "").trim(),
          city: String(city || "").trim(),
          state: String(state || "").trim(),
          pincode: String(pincode || "").trim(),
        }),
      }).catch(() => undefined);

      if (selectedPaymentMethod === "razorpay") {
        const initRes = await fetch("/api/payments/razorpay/create-order", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: safeEmail,
            lineItems,
            total,
            mobile: safeMobile,
            address: safeAddress,
            street: String(street || "").trim(),
            area: String(area || "").trim(),
            city: String(city || "").trim(),
            state: String(state || "").trim(),
            pincode: String(pincode || "").trim(),
            location: locationLat && locationLng ? { lat: locationLat, lng: locationLng } : undefined,
          }),
        });
        const initJson = await readJsonSafe(initRes);
        if (!initRes.ok) {
          throw new Error(String(initJson.error || "Unable to initialize Razorpay payment."));
        }
        const effectiveKey = String(initJson?.keyId || razorpayKeyId || "").trim();
        if (!effectiveKey) {
          throw new Error("Razorpay key is missing. Configure it in CMS.");
        }
        if (!window.Razorpay) {
          await new Promise<void>((resolve, reject) => {
            const existing = document.querySelector(
              'script[src="https://checkout.razorpay.com/v1/checkout.js"]'
            ) as HTMLScriptElement | null;
            if (existing) {
              existing.addEventListener("load", () => resolve(), { once: true });
              existing.addEventListener("error", () => reject(new Error("Unable to load Razorpay SDK.")), {
                once: true,
              });
              return;
            }
            const script = document.createElement("script");
            script.src = "https://checkout.razorpay.com/v1/checkout.js";
            script.async = true;
            script.onload = () => resolve();
            script.onerror = () => reject(new Error("Unable to load Razorpay SDK."));
            document.body.appendChild(script);
          });
        }
        if (!window.Razorpay) {
          throw new Error("Razorpay SDK unavailable.");
        }
        let paymentCaptured = false;
        const razorpay = new window.Razorpay({
          key: effectiveKey,
          amount: Number(initJson.amount || 0),
          currency: String(initJson.currency || "INR"),
          name: "Revampfy",
          description: "Order payment",
          order_id: String(initJson.razorpayOrderId || ""),
          prefill: { email: safeEmail },
          notes: {
            Catalog_draft_order_id: String(initJson.draftOrderId || ""),
          },
          handler: async (response) => {
            try {
              const verifyRes = await fetch("/api/payments/razorpay/verify", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  razorpayOrderId: response.razorpay_order_id,
                  razorpayPaymentId: response.razorpay_payment_id,
                  razorpaySignature: response.razorpay_signature,
                  draftOrderId: Number(initJson.draftOrderId || 0),
                }),
              });
              const verifyJson = await readJsonSafe(verifyRes);
              if (!verifyRes.ok) {
                throw new Error(String(verifyJson.error || "Payment verification failed."));
              }
              paymentCaptured = true;
              setMessage("Order placed successfully.");
              setError("");
              window.sessionStorage.removeItem(PENDING_PAYMENT_KEY);
              window.sessionStorage.removeItem(RETURN_RELOAD_DONE_KEY);
              if (isCartCheckout) {
                clearCartInStorage();
                setCartItems([]);
              }
              window.setTimeout(() => {
                window.location.href = "/user-dashboard?payment=success";
              }, 350);
            } catch {
              await fetch("/api/catalog/draft-orders/fail", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ draftOrderId: Number(initJson.draftOrderId || 0) }),
              }).catch(() => undefined);
              setError("Payment failed, Try again.");
            } finally {
              setPlacingOrder(false);
            }
          },
          modal: {
            ondismiss: () => {
              if (!paymentCaptured) {
                void fetch("/api/catalog/draft-orders/fail", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ draftOrderId: Number(initJson.draftOrderId || 0) }),
                }).catch(() => undefined);
                setMessage("");
                setError("Payment failed, Try again.");
                window.sessionStorage.removeItem(PENDING_PAYMENT_KEY);
                window.sessionStorage.removeItem(RETURN_RELOAD_DONE_KEY);
              }
              document.body.style.overflow = "";
              setPlacingOrder(false);
            },
          },
        });
        managedByRazorpay = true;
        razorpay.open();
        return;
      }

      if (selectedPaymentMethod === "payu") {
        const initRes = await fetch("/api/payments/payu/create-order", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: safeEmail,
            lineItems,
            total,
            address: safeAddress,
            mobile: safeMobile,
            street: String(street || "").trim(),
            area: String(area || "").trim(),
            city: String(city || "").trim(),
            state: String(state || "").trim(),
            pincode: String(pincode || "").trim(),
            location: locationLat && locationLng ? { lat: locationLat, lng: locationLng } : undefined,
          }),
        });
        const initJson = await readJsonSafe(initRes);
        if (!initRes.ok) {
          throw new Error(String(initJson.error || "Unable to initialize PayU payment."));
        }
        const formConfig = initJson?.paymentForm;
        if (!formConfig?.action || !formConfig?.fields) {
          throw new Error("PayU payment form config missing.");
        }
        const form = document.createElement("form");
        form.method = String(formConfig.method || "POST");
        form.action = String(formConfig.action);
        form.style.display = "none";
        Object.entries(formConfig.fields as Record<string, string>).forEach(([key, value]) => {
          const input = document.createElement("input");
          input.type = "hidden";
          input.name = key;
          input.value = String(value || "");
          form.appendChild(input);
        });
        document.body.appendChild(form);
        form.submit();
        return;
      }

      if (selectedPaymentMethod === "cod") {
        const codRes = await fetch("/api/catalog/orders", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: safeEmail,
            note: "COD checkout",
            lineItems,
            total,
            paymentMethod: "cod",
            address: safeAddress,
            mobile: safeMobile,
            street: String(street || "").trim(),
            area: String(area || "").trim(),
            city: String(city || "").trim(),
            state: String(state || "").trim(),
            pincode: String(pincode || "").trim(),
            location: { lat: locationLat, lng: locationLng },
          }),
        });
        const codJson = await readJsonSafe(codRes);
        if (!codRes.ok) throw new Error(String(codJson.error || "Unable to place COD order."));
        setMessage("Order placed successfully.");
        if (isCartCheckout) {
          clearCartInStorage();
          setCartItems([]);
        }
        window.setTimeout(() => {
          window.location.href = "/user-dashboard?payment=success";
        }, 350);
        return;
      }

      const res = await fetch("/api/catalog/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: safeEmail,
          note: "Buy it now checkout",
          lineItems,
          total,
          paymentMethod: selectedPaymentMethod,
          mobile: safeMobile,
          address: safeAddress,
          street: String(street || "").trim(),
          area: String(area || "").trim(),
          city: String(city || "").trim(),
          state: String(state || "").trim(),
          pincode: String(pincode || "").trim(),
          location: locationLat && locationLng ? { lat: locationLat, lng: locationLng } : undefined,
        }),
      });
      const json = await readJsonSafe(res);
      if (!res.ok) {
        throw new Error(String(json.error || "Checkout failed"));
      }

      const invoiceUrl = String(json?.draftOrder?.invoice_url || "").trim();
      if (isAllowedInvoiceUrl(invoiceUrl)) {
        const paymentsUrl = toPaymentsHostUrl(invoiceUrl);
        try {
          window.sessionStorage.setItem(FORCE_RELOAD_ON_RETURN_KEY, "1");
          window.sessionStorage.setItem(
            PENDING_PAYMENT_KEY,
            JSON.stringify({
              startedAt: Date.now(),
              checkoutUrl: window.location.href,
              invoiceUrl: paymentsUrl,
              draftOrderId: Number(json?.draftOrder?.id || 0),
              orderRef: String(json?.draftOrder?.name || ""),
            })
          );
        } catch {
          // ignore storage failures
        }
        window.location.href = paymentsUrl;
        return;
      }
      setMessage("Order created successfully.");
      if (isCartCheckout) {
        clearCartInStorage();
        setCartItems([]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Checkout failed");
    } finally {
      if (!managedByRazorpay) {
        setPlacingOrder(false);
      }
    }
  };

  const applyAddressSuggestion = useCallback((entry: AddressSuggestion | null) => {
    if (!entry) return;
    setSelectedAddressLabel(entry.label || "");
    setAddress(entry.label || "");
    setStreet(entry.street || "");
    setArea(entry.area || "");
    setCity(entry.city || "");
    setState(entry.state || "");
    setPincode(entry.pincode || "");
    setLocationLat(entry.lat || "");
    setLocationLng(entry.lng || "");
  }, []);

  useEffect(() => {
    const query = address.trim();
    if (query.length < 3) {
      setAddressSuggestions([]);
      return;
    }
    const timer = window.setTimeout(async () => {
      try {
        setSearchingAddress(true);
        const res = await fetch(`/api/location/search?q=${encodeURIComponent(query)}`, { cache: "no-store" });
        const json = await readJsonSafe(res);
        if (res.ok && Array.isArray(json?.suggestions)) {
          const suggestions = json.suggestions as AddressSuggestion[];
          setAddressSuggestions(suggestions);
          if (suggestions.length === 1 && query.toLowerCase() === suggestions[0].label.toLowerCase()) {
            applyAddressSuggestion(suggestions[0]);
          }
        } else {
          setAddressSuggestions([]);
        }
      } catch {
        setAddressSuggestions([]);
      } finally {
        setSearchingAddress(false);
      }
    }, 350);
    return () => window.clearTimeout(timer);
  }, [address, applyAddressSuggestion]);

  return (
    <section className="section">
      <div className="container">
        <div className="admin">
          <h1>Checkout</h1>
          <p className="hero__subtext">Review variant and continue to payment.</p>
          <div className="admin__panel">
            {loading ? (
              <div>
                <p className="hero__subtext">Loading checkout...</p>
                <button className="secondary" type="button" onClick={() => void loadData()}>
                  Retry
                </button>
              </div>
            ) : null}
            {!loading && !isCartCheckout && !selected ? (
              <p className="hero__subtext">Product or variant not found. Go back to store.</p>
            ) : null}
            {!loading && (isCartCheckout || selected) ? (
              <div className="checkout">
                {isCartCheckout ? (
                  <div className="checkout__product">
                    <h3>Cart Checkout</h3>
                    {cartItems.length ? (
                      cartItems.map((item) => (
                        <p key={item.variantId}>
                          {item.title} ({item.variantTitle}) x {item.quantity} -{" "}
                          {formatPrice(String(Number(item.price) * item.quantity))}
                        </p>
                      ))
                    ) : (
                      <p className="hero__subtext">Cart is empty.</p>
                    )}
                    <p>Total: {formatPrice(String(total))}</p>
                  </div>
                ) : (
                  <div className="checkout__product">
                    <h3>{selected?.product.title}</h3>
                    <p>Variant: {selected?.variant.title || "Default"}</p>
                    <p>Quantity: {quantity}</p>
                    <p>Unit price: {formatPrice(selected?.variant.price)}</p>
                    <p>Total: {formatPrice(String(total))}</p>
                  </div>
                )}
                <div className="admin__form">
                  <input
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="Email"
                  />
                  <input
                    value={mobile}
                    onChange={(event) => setMobile(event.target.value)}
                    placeholder="Mobile number"
                  />
                  <div style={{ position: "relative" }}>
                    <input
                      value={address}
                      onChange={(event) => {
                        const next = event.target.value;
                        setAddress(next);
                        setShowAddressSuggestions(next.trim().length >= 3);
                        if (!next.trim()) {
                          setSelectedAddressLabel("");
                        }
                        const exact = addressSuggestions.find(
                          (entry) => entry.label.toLowerCase() === next.trim().toLowerCase()
                        );
                        if (exact) {
                          applyAddressSuggestion(exact);
                          setShowAddressSuggestions(false);
                        }
                      }}
                      onFocus={() => {
                        if (address.trim().length >= 3 && addressSuggestions.length) {
                          setShowAddressSuggestions(true);
                        }
                      }}
                      onBlur={() => {
                        window.setTimeout(() => setShowAddressSuggestions(false), 120);
                      }}
                      onKeyDown={(event) => {
                        if (event.key !== "Enter") return;
                        const query = address.trim().toLowerCase();
                        const exact = addressSuggestions.find((entry) => entry.label.toLowerCase() === query);
                        const first = exact || addressSuggestions[0] || null;
                        if (first) {
                          event.preventDefault();
                          applyAddressSuggestion(first);
                          setShowAddressSuggestions(false);
                        }
                      }}
                      placeholder="Address"
                    />
                    {showAddressSuggestions && addressSuggestions.length ? (
                      <div
                        style={{
                          position: "absolute",
                          left: 0,
                          right: 0,
                          top: "calc(100% + 4px)",
                          zIndex: 40,
                          border: "1px solid rgba(148,163,184,0.45)",
                          borderRadius: 10,
                          background: "var(--panel-bg, #0b1220)",
                          maxHeight: 220,
                          overflowY: "auto",
                        }}
                      >
                        {addressSuggestions.map((entry) => (
                          <button
                            key={`${entry.label}-${entry.lat}-${entry.lng}`}
                            type="button"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => {
                              applyAddressSuggestion(entry);
                              setShowAddressSuggestions(false);
                            }}
                            style={{
                              width: "100%",
                              textAlign: "left",
                              padding: "0.55rem 0.65rem",
                              border: 0,
                              borderBottom: "1px solid rgba(148,163,184,0.18)",
                              background: "transparent",
                              color: "inherit",
                              cursor: "pointer",
                              fontSize: "0.92rem",
                            }}
                          >
                            {entry.label}
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </div>
                  {searchingAddress ? <small>Searching address suggestions...</small> : null}
                  {!searchingAddress && address.trim().length >= 3 && addressSuggestions.length === 0 ? (
                    <small>No address suggestions found. Please refine your address and use current location.</small>
                  ) : null}
                  {selectedAddressLabel ? <small>Selected: {selectedAddressLabel}</small> : null}
                  <input value={street} onChange={(e) => setStreet(e.target.value)} placeholder="Street" />
                  <input value={area} onChange={(e) => setArea(e.target.value)} placeholder="Area" />
                  <input value={city} onChange={(e) => setCity(e.target.value)} placeholder="City" />
                  <input value={state} onChange={(e) => setState(e.target.value)} placeholder="State" />
                  <input value={pincode} onChange={(e) => setPincode(e.target.value)} placeholder="Pincode" />
                  <select value={selectedPaymentMethod} onChange={(event) => setSelectedPaymentMethod(event.target.value as PaymentGateway)}>
                    {razorpayEnabled || paymentGateway === "razorpay" ? <option value="razorpay">Razorpay</option> : null}
                    <option value="manual">Manual</option>
                    {payuEnabled ? <option value="payu">PayU</option> : null}
                    {enableCod ? <option value="cod">Cash On Delivery</option> : null}
                  </select>
                  <button
                    className="secondary"
                    type="button"
                    onClick={() => {
                      if (!navigator.geolocation) {
                        setError("Geolocation is not supported in this browser.");
                        return;
                      }
                      navigator.geolocation.getCurrentPosition(
                        async (position) => {
                          const lat = String(position.coords.latitude);
                          const lng = String(position.coords.longitude);
                          setLocationLat(lat);
                          setLocationLng(lng);
                          try {
                            const geoRes = await fetch(
                              `/api/location/reverse-geocode?lat=${encodeURIComponent(lat)}&lng=${encodeURIComponent(lng)}`,
                              { cache: "no-store" }
                            );
                            const geoJson = await readJsonSafe(geoRes);
                            if (geoRes.ok && geoJson?.location) {
                              setStreet(String(geoJson.location.street || ""));
                              setArea(String(geoJson.location.area || ""));
                              setCity(String(geoJson.location.city || ""));
                              setState(String(geoJson.location.state || ""));
                              setPincode(String(geoJson.location.pincode || ""));
                              const resolved = String(geoJson.location.fullAddress || "").trim();
                              if (resolved) setAddress(resolved);
                            }
                          } catch {
                            // keep GPS even if reverse geocode fails
                          }
                          setError("");
                        },
                        () => setError("Unable to fetch GPS location. Allow location permission and retry.")
                      );
                    }}
                  >
                    Use Current Location (Mandatory)
                  </button>
                  <div className="hero__subtext">
                    GPS: {locationLat && locationLng ? `${locationLat}, ${locationLng}` : "not captured"}
                  </div>
                  <button className="primary" type="button" onClick={placeOrder} disabled={placingOrder}>
                    {placingOrder
                      ? "Processing..."
                      : selectedPaymentMethod === "razorpay"
                        ? "Pay with Razorpay"
                        : selectedPaymentMethod === "payu"
                          ? "Pay with PayU"
                          : selectedPaymentMethod === "cod"
                            ? "Place COD Order"
                            : "Pay Now"}
                  </button>
                </div>
              </div>
            ) : null}
            {message ? <div className="admin__alert admin__alert--success">{message}</div> : null}
            {error ? <div className="admin__alert admin__alert--error">{error}</div> : null}
          </div>
        </div>
      </div>
    </section>
  );
}


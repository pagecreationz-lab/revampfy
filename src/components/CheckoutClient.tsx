"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { ShopifyProduct } from "@/lib/shopify";
import { clearCartInStorage, getCartItemsFromStorage, type CartItem } from "@/lib/cart";

type Variant = NonNullable<ShopifyProduct["variants"]>[number];

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

export function CheckoutClient() {
  const params = useSearchParams();
  const [products, setProducts] = useState<ShopifyProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [placingOrder, setPlacingOrder] = useState(false);
  const [email, setEmail] = useState("");
  const [cartItems, setCartItems] = useState<CartItem[]>([]);

  const productId = Number(params.get("productId") || "");
  const variantId = Number(params.get("variantId") || "");
  const quantity = Math.max(1, Number(params.get("qty") || "1"));
  const isCartCheckout = params.get("cart") === "1";

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const [sessionRes, syncRes] = await Promise.all([
          fetch("/api/auth/session"),
          fetch("/api/shopify/sync"),
        ]);
        const sessionJson = await sessionRes.json();
        if (sessionJson?.session?.email) {
          setEmail(sessionJson.session.email);
        }
        const syncJson = await syncRes.json();
        setProducts(syncJson?.payload?.products || []);
        setCartItems(getCartItemsFromStorage());
      } catch {
        setError("Could not load checkout details.");
      } finally {
        setLoading(false);
      }
    };

    void loadData();
  }, []);

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
    if (!email.trim()) {
      setError("Email is required.");
      return;
    }

    setPlacingOrder(true);
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

      const res = await fetch("/api/shopify/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          note: "Buy it now checkout",
          lineItems,
          total,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || "Checkout failed");
      }

      setMessage(
        json?.draftOrder?.invoice_url
          ? `Order created. Complete payment: ${json.draftOrder.invoice_url}`
          : "Order created successfully."
      );
      if (isCartCheckout) {
        clearCartInStorage();
        setCartItems([]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Checkout failed");
    } finally {
      setPlacingOrder(false);
    }
  };

  return (
    <section className="section">
      <div className="container">
        <div className="admin">
          <h1>Checkout</h1>
          <p className="hero__subtext">Review variant and continue to payment.</p>
          <div className="admin__panel">
            {loading ? <p className="hero__subtext">Loading checkout...</p> : null}
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
                  <button className="primary" type="button" onClick={placeOrder} disabled={placingOrder}>
                    {placingOrder ? "Processing..." : "Create Payment Link"}
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

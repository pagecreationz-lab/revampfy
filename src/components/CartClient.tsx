"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { CartItem } from "@/lib/cart";
import { getCartItemsFromStorage, setCartItemsToStorage } from "@/lib/cart";
import type { ShopifyProduct } from "@/lib/shopify";

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

export function CartClient({ isAuthenticated }: { isAuthenticated: boolean }) {
  const router = useRouter();
  const [items, setItems] = useState<CartItem[]>([]);
  const [products, setProducts] = useState<ShopifyProduct[]>([]);
  const [shippingFlatRate, setShippingFlatRate] = useState(199);
  const [taxRatePct, setTaxRatePct] = useState(18);

  useEffect(() => {
    setItems(getCartItemsFromStorage());
    const loadProducts = async () => {
      try {
        const [syncRes, commerceRes] = await Promise.all([
          fetch("/api/shopify/sync"),
          fetch("/api/shopify/commerce-status"),
        ]);
        const syncJson = await syncRes.json();
        const commerceJson = await commerceRes.json();
        setProducts(syncJson?.payload?.products || []);
        if (commerceJson?.config) {
          setShippingFlatRate(Number(commerceJson.config.shippingFlatRate || 0));
          setTaxRatePct(Number(commerceJson.config.taxRatePct || 0));
        }
      } catch {
        setProducts([]);
      }
    };
    void loadProducts();
  }, []);

  const productById = useMemo(() => {
    return products.reduce(
      (acc: Record<number, ShopifyProduct>, product) => {
        acc[product.id] = product;
        return acc;
      },
      {}
    );
  }, [products]);

  const total = useMemo(
    () => items.reduce((sum, item) => sum + Number(item.price || 0) * item.quantity, 0),
    [items]
  );
  const shipping = useMemo(() => (total > 0 ? shippingFlatRate : 0), [total, shippingFlatRate]);
  const tax = useMemo(() => Math.round(total * (taxRatePct / 100)), [total, taxRatePct]);
  const grandTotal = useMemo(() => total + shipping + tax, [total, shipping, tax]);

  const updateItems = (next: CartItem[]) => {
    setItems(next);
    setCartItemsToStorage(next);
  };

  const setQuantity = (variantId: number, quantity: number) => {
    const next = items
      .map((item) =>
        item.variantId === variantId ? { ...item, quantity: Math.max(1, quantity) } : item
      )
      .filter((item) => item.quantity > 0);
    updateItems(next);
  };

  const removeItem = (variantId: number) => {
    updateItems(items.filter((item) => item.variantId !== variantId));
  };

  const proceedToPayment = () => {
    if (!isAuthenticated) {
      router.push("/login?next=%2Fcheckout%3Fcart%3D1");
      return;
    }
    router.push("/checkout?cart=1");
  };

  return (
    <section className="section">
      <div className="container">
        <div className="admin">
          <h1>My Cart</h1>
          <p className="hero__subtext">Review your selected products before payment.</p>
          <div className="admin__panel">
            {!items.length ? <p className="hero__subtext">Cart is empty.</p> : null}
            <div className="store-cart__list">
              {items.map((item) => {
                const product = productById[item.productId];
                const image =
                  product?.images?.[0]?.src ||
                  "https://images.unsplash.com/photo-1498049860654-af1a5c566876?q=80&w=800&auto=format&fit=crop";
                const unitPrice = Number(item.price || 0);
                const lineTotal = unitPrice * item.quantity;
                return (
                  <div className="store-cart__item store-cart__item--detailed" key={item.variantId}>
                    <img className="store-cart__image" src={image} alt={item.title} />
                    <div className="store-cart__meta">
                      <strong>{item.title}</strong>
                      <small>
                        <a href={`/store/${item.productId}`}>View product</a>
                      </small>
                      <small>Variant: {item.variantTitle}</small>
                      <small>Unit: {formatPrice(String(unitPrice))}</small>
                      <small>Subtotal: {formatPrice(String(lineTotal))}</small>
                    </div>
                    <div className="store-cart__controls">
                      <div className="store-cart__qty">
                        <button
                          className="ghost"
                          type="button"
                          onClick={() => setQuantity(item.variantId, item.quantity - 1)}
                        >
                          -
                        </button>
                        <span>{item.quantity}</span>
                        <button
                          className="ghost"
                          type="button"
                          onClick={() => setQuantity(item.variantId, item.quantity + 1)}
                        >
                          +
                        </button>
                      </div>
                      <button
                        className="secondary store-cart__remove"
                        type="button"
                        onClick={() => removeItem(item.variantId)}
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="cart-summary">
              <h3>Price Summary</h3>
              <div className="cart-summary__row">
                <span>Subtotal</span>
                <strong>{formatPrice(String(total))}</strong>
              </div>
              <div className="cart-summary__row">
                <span>Shipping</span>
                <strong>{formatPrice(String(shipping))}</strong>
              </div>
              <div className="cart-summary__row">
                <span>Tax (GST {taxRatePct}%)</span>
                <strong>{formatPrice(String(tax))}</strong>
              </div>
              <div className="cart-summary__row cart-summary__row--grand">
                <span>Grand Total</span>
                <strong>{formatPrice(String(grandTotal))}</strong>
              </div>
            </div>
            <button className="primary" type="button" onClick={proceedToPayment} disabled={!items.length}>
              Proceed to Payment
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

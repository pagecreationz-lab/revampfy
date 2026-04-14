export type CartItem = {
  productId: number;
  title: string;
  variantId: number;
  variantTitle: string;
  quantity: number;
  price: string;
};

const CART_ITEMS_KEY = "pcgs_cart_items";
const CART_COUNT_KEY = "pcgs_cart_count";

export function getCartItemsFromStorage(): CartItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(CART_ITEMS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as CartItem[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function setCartItemsToStorage(items: CartItem[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(CART_ITEMS_KEY, JSON.stringify(items));
  const count = items.reduce((sum, item) => sum + item.quantity, 0);
  localStorage.setItem(CART_COUNT_KEY, String(count));
  window.dispatchEvent(new Event("pcgs-cart-updated"));
}

export function clearCartInStorage() {
  setCartItemsToStorage([]);
}

export function addCartItemToStorage(item: CartItem) {
  const items = getCartItemsFromStorage();
  const existing = items.find((entry) => entry.variantId === item.variantId);
  if (existing) {
    existing.quantity += item.quantity;
    setCartItemsToStorage([...items]);
    return;
  }
  setCartItemsToStorage([...items, item]);
}


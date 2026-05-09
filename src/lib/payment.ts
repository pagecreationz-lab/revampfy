const CHECKOUT_PAYMENT_HOST =
  (process.env.NEXT_PUBLIC_CHECKOUT_PAYMENT_HOST || "payments.revampfy.in").toLowerCase();

export function isAllowedInvoiceUrl(raw: string): boolean {
  if (!raw) return false;
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:" && url.protocol !== "http:") return false;
    const host = url.hostname.toLowerCase();
    if (!host.endsWith(".myCatalog.com") && host !== CHECKOUT_PAYMENT_HOST) return false;
    return url.pathname.includes("/invoices/");
  } catch {
    return false;
  }
}

export function toCheckoutPaymentUrl(raw: string): string {
  if (!isAllowedInvoiceUrl(raw)) return "";
  try {
    const url = new URL(raw);
    const host = url.hostname.toLowerCase();
    if (host.endsWith(".myCatalog.com")) {
      url.protocol = "https:";
      url.hostname = CHECKOUT_PAYMENT_HOST;
      url.port = "";
    }
    return url.toString();
  } catch {
    return "";
  }
}

export function canEmbedInvoiceUrl(raw: string): boolean {
  if (!isAllowedInvoiceUrl(raw)) return false;
  try {
    const url = new URL(raw);
    const host = url.hostname.toLowerCase();
    // Catalog invoice pages are protected with anti-iframe headers.
    if (host.endsWith(".myCatalog.com")) return false;
    return true;
  } catch {
    return false;
  }
}


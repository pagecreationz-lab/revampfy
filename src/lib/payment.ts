export function isAllowedInvoiceUrl(raw: string): boolean {
  if (!raw) return false;
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:" && url.protocol !== "http:") return false;
    const host = url.hostname.toLowerCase();
    if (!host.endsWith(".myshopify.com")) return false;
    return url.pathname.includes("/invoices/");
  } catch {
    return false;
  }
}

export function canEmbedInvoiceUrl(raw: string): boolean {
  if (!isAllowedInvoiceUrl(raw)) return false;
  try {
    const url = new URL(raw);
    const host = url.hostname.toLowerCase();
    // Shopify invoice pages are protected with anti-iframe headers.
    if (host.endsWith(".myshopify.com")) return false;
    return true;
  } catch {
    return false;
  }
}

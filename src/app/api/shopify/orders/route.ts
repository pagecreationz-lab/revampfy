import { createDraftOrder } from "@/lib/shopify";
import { readSessionFromRequest, verifySessionToken } from "@/lib/auth";
import { appendCustomerOrder } from "@/lib/customerData";
import { getShopifyCommerceConfig } from "@/lib/shopifyCommerce";

type CartLine = {
  variantId: number;
  quantity: number;
};

export async function POST(request: Request) {
  const token = readSessionFromRequest(request);
  const session = verifySessionToken(token);
  if (!session) {
    return Response.json({ error: "Unauthorized. Please login." }, { status: 401 });
  }

  try {
    const commerceConfig = await getShopifyCommerceConfig();
    if (!commerceConfig.enableCheckout || !commerceConfig.enablePayments) {
      return Response.json(
        { error: "Checkout or payments are disabled by CMS admin." },
        { status: 403 }
      );
    }

    const payload = await request.json();
    const lineItems = Array.isArray(payload?.lineItems)
      ? (payload.lineItems as CartLine[])
      : [];
    const email = String(payload?.email || session.email || "").trim();
    const note = String(payload?.note || "").trim();
    const total = Number(payload?.total || 0);

    if (!email) {
      return Response.json({ error: "Email is required." }, { status: 400 });
    }

    const sanitizedItems = lineItems
      .map((line) => ({
        variantId: Number(line.variantId),
        quantity: Math.max(1, Number(line.quantity) || 1),
      }))
      .filter((line) => Number.isFinite(line.variantId) && line.variantId > 0);

    if (!sanitizedItems.length) {
      return Response.json({ error: "No valid cart items found." }, { status: 400 });
    }

    const draftOrder = await createDraftOrder({
      email,
      lineItems: sanitizedItems,
      note: note || `Customer portal order by ${session.email}`,
    });

    if (session.role === "customer") {
      await appendCustomerOrder({
        email: session.email,
        orderRef: String(draftOrder?.name || draftOrder?.id || `DRAFT-${Date.now()}`),
        status: "Draft created",
        total: Number.isFinite(total) ? total : 0,
        invoiceUrl: draftOrder?.invoice_url || "",
        lineItems: sanitizedItems.map((line) => ({
          variantId: line.variantId,
          quantity: line.quantity,
        })),
      });
    }

    return Response.json({ ok: true, draftOrder });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to place order.";
    const normalized = message.toLowerCase();
    const scopeIssue =
      normalized.includes("merchant approval") ||
      normalized.includes("write_draft_orders") ||
      normalized.includes("(403)");
    return Response.json(
      {
        error: scopeIssue
          ? "Checkout is blocked: Shopify token is missing write_draft_orders approval. Reconnect Shopify in CMS and approve updated scopes."
          : message,
      },
      { status: scopeIssue ? 403 : 500 }
    );
  }
}

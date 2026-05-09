import { completeDraftOrderPaid, createDraftOrder } from "@/lib/catalog";
import { readSessionFromRequest, verifySessionToken } from "@/lib/auth";
import { appendCustomerOrder } from "@/lib/customerData";
import { getCatalogCommerceConfig } from "@/lib/catalogCommerce";
import { createShiprocketShipment } from "@/lib/shiprocket";

type CartLine = {
  variantId: number;
  quantity: number;
};

function normalizeCheckoutEmail(input: string, sessionEmail: string): string {
  const raw = input.trim().toLowerCase();
  const sessionRaw = sessionEmail.trim().toLowerCase();
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  const mobileFallbackFrom = (value: string) => {
    const match = value.match(/^mobile(\d{10,15})@/i);
    if (!match?.[1]) return "";
    return `mobile${match[1]}@revampfy.in`;
  };

  const localDomainFallback = (value: string) => {
    if (!value.endsWith(".local")) return "";
    const localPart = value.split("@")[0]?.trim();
    if (!localPart) return "";
    return `${localPart}@revampfy.in`;
  };

  // Migrate legacy placeholder domains used by OTP flow.
  if (raw.endsWith("@pcgs.local") || raw.endsWith(".local")) {
    const migrated = mobileFallbackFrom(raw) || localDomainFallback(raw);
    if (migrated) return migrated;
  }
  if (sessionRaw.endsWith("@pcgs.local") || sessionRaw.endsWith(".local")) {
    const migrated = mobileFallbackFrom(sessionRaw) || localDomainFallback(sessionRaw);
    if (migrated) return migrated;
  }

  if (emailPattern.test(raw)) return raw;
  if (emailPattern.test(sessionRaw)) return sessionRaw;
  return "";
}

export async function POST(request: Request) {
  const token = readSessionFromRequest(request);
  const session = verifySessionToken(token);
  if (!session) {
    return Response.json({ error: "Unauthorized. Please login." }, { status: 401 });
  }

  try {
    const commerceConfig = await getCatalogCommerceConfig();
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
    const email = normalizeCheckoutEmail(
      String(payload?.email || session.email || ""),
      String(session.email || "")
    );
    const note = String(payload?.note || "").trim();
    const total = Number(payload?.total || 0);
    const paymentMethod = String(payload?.paymentMethod || "online").trim().toLowerCase();
    const mobile = String(payload?.mobile || "").trim();
    const address = String(payload?.address || "").trim();
    const street = String(payload?.street || "").trim();
    const area = String(payload?.area || "").trim();
    const city = String(payload?.city || "").trim();
    const state = String(payload?.state || "").trim();
    const pincode = String(payload?.pincode || "").trim();
    const location = payload?.location as { lat?: string; lng?: string } | undefined;

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

    if (!mobile || !address || !street || !area || !city || !state || !pincode) {
      return Response.json(
        { error: "Mobile, address, street, area, city, state, and pincode are required." },
        { status: 400 }
      );
    }
    if (!location?.lat || !location?.lng) {
      return Response.json({ error: "Exact GPS location is required for all payment methods." }, { status: 400 });
    }

    const draftOrder = await createDraftOrder({
      email,
      lineItems: sanitizedItems,
      paymentMethod,
      mobile,
      address,
      street,
      area,
      city,
      state,
      pincode,
      location,
      note: note || `Customer portal order by ${session.email}`,
    });

    if (session.role === "customer" && paymentMethod !== "cod") {
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

    if (paymentMethod === "cod") {
      const completed = await completeDraftOrderPaid(Number(draftOrder.id), {
        paymentMethod: "cod",
        transactionStatus: "cod_pending",
        paymentId: `COD-${draftOrder.id}`,
      });
      await createShiprocketShipment({
        draftOrderId: Number(draftOrder.id),
        orderRef: String(draftOrder.name || draftOrder.id),
        customerEmail: email,
        customerPhone: mobile,
        shippingAddress: address,
        totalAmount: Number.isFinite(total) ? total : 0,
      }).catch(() => undefined);
      return Response.json({ ok: true, draftOrder, completedOrder: completed });
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
          ? "Checkout is blocked: Catalog token is missing write_draft_orders approval. Reconnect Catalog in CMS and approve updated scopes."
          : message,
      },
      { status: scopeIssue ? 403 : 500 }
    );
  }
}


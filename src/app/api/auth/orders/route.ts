import { readSessionFromRequest, verifySessionToken } from "@/lib/auth";
import { listCustomerOrders } from "@/lib/customerData";
import { getOrdersByEmail } from "@/lib/catalog";
import { getCatalogCommerceConfig } from "@/lib/catalogCommerce";

export async function GET(request: Request) {
  const token = readSessionFromRequest(request);
  const session = verifySessionToken(token);
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.role !== "customer") {
    return Response.json({ error: "Customer access only" }, { status: 403 });
  }

  const commerceConfig = await getCatalogCommerceConfig();
  const [localOrders, CatalogOrders] = await Promise.all([
    listCustomerOrders(session.email),
    commerceConfig.enableCustomerAccounts
      ? getOrdersByEmail(session.email, 20).catch(() => [])
      : Promise.resolve([]),
  ]);

  const merged = [
    ...CatalogOrders.map((order) => ({
      id: `Catalog-${order.id}`,
      email: session.email,
      orderRef: order.name || `#${order.id}`,
      status: [order.financialStatus, order.fulfillmentStatus].filter(Boolean).join(" / ") || "Open",
      total: Number(order.totalPrice || 0),
      invoiceUrl: order.statusUrl || "",
      lineItems: [] as Array<{ variantId: number; quantity: number }>,
      createdAt: order.createdAt,
      source: "cms",
    })),
    ...localOrders.map((order) => ({ ...order, source: "portal" })),
  ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return Response.json({ orders: merged });
}


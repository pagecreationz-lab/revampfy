import { readSessionFromRequest, verifySessionToken } from "@/lib/auth";
import { getDraftOrderStatus } from "@/lib/catalog";

export async function GET(request: Request) {
  const token = readSessionFromRequest(request);
  const session = verifySessionToken(token);
  if (!session) {
    return Response.json({ error: "Unauthorized. Please login." }, { status: 401 });
  }

  const url = new URL(request.url);
  const draftOrderId = Number(url.searchParams.get("draftOrderId") || "0");
  if (!Number.isFinite(draftOrderId) || draftOrderId <= 0) {
    return Response.json({ error: "Invalid draftOrderId." }, { status: 400 });
  }

  try {
    const draft = await getDraftOrderStatus(draftOrderId);
    const status = String(draft?.status || "").toLowerCase();
    const completed = status === "completed" || Number(draft?.order_id || 0) > 0;
    return Response.json({
      ok: true,
      draftOrderId: draft.id,
      orderRef: draft.name || "",
      status,
      completed,
      orderId: Number(draft?.order_id || 0) || undefined,
      invoiceUrl: draft.invoice_url || "",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load draft order status.";
    return Response.json({ error: message }, { status: 500 });
  }
}



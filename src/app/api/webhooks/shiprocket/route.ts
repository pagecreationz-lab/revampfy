import { attachShipmentToDraftOrder } from "@/lib/catalog";
import { getCatalogCommerceConfig } from "@/lib/catalogCommerce";
import crypto from "node:crypto";

export async function POST(request: Request) {
  try {
    const config = await getCatalogCommerceConfig();
    if (!config.shiprocketWebhookSecret) {
      return Response.json({ error: "Shiprocket webhook secret not configured." }, { status: 400 });
    }
    const rawBody = await request.text();
    const signatureHeader = String(request.headers.get("x-shiprocket-signature") || "").trim().toLowerCase();
    const expected = crypto
      .createHmac("sha256", config.shiprocketWebhookSecret)
      .update(rawBody)
      .digest("hex")
      .toLowerCase();
    if (!signatureHeader || signatureHeader !== expected) {
      return Response.json({ error: "Invalid Shiprocket webhook signature." }, { status: 401 });
    }
    const payload = JSON.parse(rawBody) as Record<string, unknown>;
    const webhookPayload = payload as {
      draftOrderId?: number | string;
      order_id?: number | string;
      order?: { id?: number | string };
      status?: string;
      current_status?: string;
      awb_code?: string;
      awb?: string;
      courier_name?: string;
      courier?: string;
      timeline?: Array<{ at?: string; status?: string; note?: string }>;
    };
    const draftOrderId = Number(
      webhookPayload.draftOrderId || webhookPayload.order_id || webhookPayload.order?.id || 0
    );
    if (!draftOrderId) return Response.json({ ok: true });
    const status = String(webhookPayload.status || webhookPayload.current_status || "in_transit");
    const awb = String(webhookPayload.awb_code || webhookPayload.awb || "");
    const courier = String(webhookPayload.courier_name || webhookPayload.courier || "Shiprocket");
    const timeline = Array.isArray(webhookPayload.timeline)
      ? webhookPayload.timeline.map((item: { at?: string; status?: string; note?: string }) => ({
          at: String(item.at || new Date().toISOString()),
          status: String(item.status || ""),
          note: item.note ? String(item.note) : undefined,
        }))
      : [{ at: new Date().toISOString(), status }];
    await attachShipmentToDraftOrder(draftOrderId, {
      awb,
      courier,
      status,
      timeline,
    });
    return Response.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Shiprocket webhook failed.";
    return Response.json({ error: message }, { status: 500 });
  }
}

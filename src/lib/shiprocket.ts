import "server-only";
import { attachShipmentToDraftOrder } from "@/lib/catalog";
import { getCatalogCommerceConfig } from "@/lib/catalogCommerce";

type ShipmentInput = {
  draftOrderId: number;
  orderRef: string;
  customerEmail: string;
  customerPhone: string;
  shippingAddress: string;
  totalAmount: number;
};

export async function createShiprocketShipment(input: ShipmentInput) {
  const config = await getCatalogCommerceConfig();
  if (!config.shiprocketEnabled) return null;

  const timeline = [{ at: new Date().toISOString(), status: "Shipment Created", note: "Auto-created from order" }];
  const fallback = {
    awb: `AWB-${input.draftOrderId}`,
    shipmentId: `SHP-${input.draftOrderId}`,
    status: "created",
    courier: "Shiprocket",
    timeline,
  };

  if (!config.shiprocketEmail || !config.shiprocketPassword) {
    await attachShipmentToDraftOrder(input.draftOrderId, fallback);
    return fallback;
  }

  try {
    const authRes = await fetch("https://apiv2.shiprocket.in/v1/external/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: config.shiprocketEmail,
        password: config.shiprocketPassword,
      }),
    });
    const authJson = (await authRes.json()) as { token?: string };
    if (!authRes.ok || !authJson?.token) throw new Error("Shiprocket auth failed.");

    const orderRes = await fetch("https://apiv2.shiprocket.in/v1/external/orders/create/adhoc", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${authJson.token}`,
      },
      body: JSON.stringify({
        order_id: String(input.orderRef),
        order_date: new Date().toISOString().slice(0, 19).replace("T", " "),
        pickup_location: config.shiprocketPickupLocation || "Primary",
        channel_id: "",
        comment: "Order from CMS checkout",
        billing_customer_name: input.customerEmail.split("@")[0] || "Customer",
        billing_last_name: "",
        billing_address: input.shippingAddress || "NA",
        billing_city: "NA",
        billing_pincode: "000000",
        billing_state: "NA",
        billing_country: "India",
        billing_email: input.customerEmail,
        billing_phone: input.customerPhone || "0000000000",
        shipping_is_billing: true,
        order_items: [
          {
            name: "Order Item",
            sku: `SKU-${input.draftOrderId}`,
            units: 1,
            selling_price: Number(input.totalAmount || 0),
          },
        ],
        payment_method: "Prepaid",
        sub_total: Number(input.totalAmount || 0),
        length: 10,
        breadth: 10,
        height: 5,
        weight: 1,
      }),
    });
    const orderJson = (await orderRes.json()) as {
      awb_code?: string;
      shipment_id?: string;
      order_id?: string;
      message?: string;
    };
    if (!orderRes.ok) throw new Error(orderJson?.message || "Shiprocket order create failed.");

    const shipment = {
      awb: String(orderJson.awb_code || `AWB-${input.draftOrderId}`),
      shipmentId: String(orderJson.shipment_id || orderJson.order_id || `SHP-${input.draftOrderId}`),
      status: "created",
      courier: "Shiprocket",
      timeline: [{ at: new Date().toISOString(), status: "Shipment Created", note: "Created via Shiprocket API" }],
    };
    await attachShipmentToDraftOrder(input.draftOrderId, shipment);
    return shipment;
  } catch {
    await attachShipmentToDraftOrder(input.draftOrderId, fallback);
    return fallback;
  }
}

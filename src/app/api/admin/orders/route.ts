import { NextResponse } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";
import { requireSession } from "@/lib/sessionGuard";
import { getOrdersByVendor } from "@/lib/catalog";
import { getVendorPortalData } from "@/lib/vendorPortal";

type AdminOrderRow = {
  id: string;
  orderRef: string;
  vendor: string;
  status: string;
  customerName: string;
  customerEmail: string;
  mobile: string;
  address: string;
  street: string;
  area: string;
  city: string;
  state: string;
  pincode: string;
  vendorAmount: number;
  totalPrice: number;
  createdAt: string;
};

type AdminOrderOverrides = {
  hiddenIds: string[];
  edits: Record<string, Partial<AdminOrderRow>>;
  manualOrders: AdminOrderRow[];
};

const overridesPath = path.join(process.cwd(), "data", "admin-orders-overrides.json");

const emptyOverrides: AdminOrderOverrides = {
  hiddenIds: [],
  edits: {},
  manualOrders: [],
};

async function readOverrides(): Promise<AdminOrderOverrides> {
  try {
    const raw = await fs.readFile(overridesPath, "utf8");
    const parsed = JSON.parse(raw) as Partial<AdminOrderOverrides>;
    return {
      hiddenIds: Array.isArray(parsed.hiddenIds) ? parsed.hiddenIds : [],
      edits: parsed.edits && typeof parsed.edits === "object" ? parsed.edits : {},
      manualOrders: Array.isArray(parsed.manualOrders) ? parsed.manualOrders : [],
    };
  } catch {
    return emptyOverrides;
  }
}

async function writeOverrides(value: AdminOrderOverrides) {
  await fs.mkdir(path.dirname(overridesPath), { recursive: true });
  await fs.writeFile(overridesPath, JSON.stringify(value, null, 2), "utf8");
}

function orderStatusBucket(status: string): "successful" | "failure" | "draft" {
  const normalized = String(status || "").trim().toLowerCase();
  if (normalized === "completed" || normalized === "paid" || normalized === "successful") {
    return "successful";
  }
  if (normalized === "failed" || normalized === "failure") return "failure";
  return "draft";
}

function withinRange(createdAt: string, days: "today" | "7" | "30") {
  const createdMs = new Date(createdAt || "").getTime();
  if (!Number.isFinite(createdMs)) return false;
  const now = Date.now();
  const ageMs = now - createdMs;
  const dayMs = 24 * 60 * 60 * 1000;
  if (days === "today") return ageMs <= dayMs;
  if (days === "7") return ageMs <= dayMs * 7;
  return ageMs <= dayMs * 30;
}

async function buildAdminOrders() {
  const data = await getVendorPortalData();
  const vendors = data.vendors.filter((v) => v.isActive).map((v) => v.name).filter(Boolean);
  const commissionByVendor = new Map(
    data.vendors.map((vendor) => [String(vendor.name || "").trim().toLowerCase(), Number(vendor.commissionPercent ?? 10)])
  );
  const all = await Promise.all(vendors.map((name) => getOrdersByVendor(name, 250)));
  const overrides = await readOverrides();
  const hiddenIds = new Set(overrides.hiddenIds || []);
  const edits = overrides.edits || {};

  const capturedRows: AdminOrderRow[] = all.flatMap((orders, idx) =>
    orders
      .map((order) => {
        const baseId = `${vendors[idx]}-${order.id}-${order.createdAt}`;
        const edited = edits[baseId] || {};
        const base: AdminOrderRow = {
          id: baseId,
          orderRef: `${order.name} #${order.id}`,
          vendor: vendors[idx],
          status: String(order.rawStatus || order.financialStatus || "pending"),
          customerName: order.customerName || "-",
          customerEmail: order.customerEmail || "-",
          mobile: order.customerMobile || "-",
          address: order.customerAddress || "-",
          street: order.customerStreet || "-",
          area: order.customerArea || "-",
          city: order.customerCity || "-",
          state: order.customerState || "-",
          pincode: order.customerPincode || "-",
          vendorAmount: Number(
            (
              Number(order.totalPrice || 0) *
              (1 - Math.min(100, Math.max(0, Number(commissionByVendor.get(String(vendors[idx]).toLowerCase()) ?? 10))) / 100)
            ).toFixed(2)
          ),
          totalPrice: Number(order.totalPrice || 0),
          createdAt: order.createdAt,
        };
        return { ...base, ...edited, id: baseId };
      })
      .filter((row) => !hiddenIds.has(row.id))
  );

  const rows = [...capturedRows, ...(overrides.manualOrders || [])].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  return { rows, vendors, overrides };
}

export async function GET(request: Request) {
  const auth = requireSession(request, "admin");
  if (auth.error) return auth.error;

  try {
    const url = new URL(request.url);
    const statusFilter = (url.searchParams.get("status") || "all").toLowerCase();
    const daysFilter = (url.searchParams.get("days") || "30").toLowerCase() as "today" | "7" | "30";
    const vendorFilter = (url.searchParams.get("vendor") || "all").trim().toLowerCase();
    const query = (url.searchParams.get("q") || "").trim().toLowerCase();
    const { rows, vendors } = await buildAdminOrders();
    const filteredRows = rows.filter((row) => {
      const matchStatus = statusFilter === "all" || orderStatusBucket(row.status) === statusFilter;
      const matchDate = withinRange(row.createdAt, daysFilter);
      const matchVendor = vendorFilter === "all" || String(row.vendor || "").trim().toLowerCase() === vendorFilter;
      const matchQuery =
        !query ||
        [
          row.orderRef,
          row.vendor,
          row.customerName,
          row.customerEmail,
          row.mobile,
          row.state,
          row.pincode,
        ]
          .join(" ")
          .toLowerCase()
          .includes(query);
      return matchStatus && matchDate && matchVendor && matchQuery;
    });

    const summary = filteredRows.reduce(
      (acc, row) => {
        acc.totalOrders += 1;
        acc.totalVendorAmount += row.vendorAmount;
        acc.totalGross += row.totalPrice;
        return acc;
      },
      { totalOrders: 0, totalVendorAmount: 0, totalGross: 0 }
    );

    return NextResponse.json({ ok: true, vendors, orders: filteredRows, summary });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to fetch orders.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = requireSession(request, "admin");
  if (auth.error) return auth.error;
  try {
    const payload = (await request.json()) as Partial<AdminOrderRow>;
    const vendor = String(payload.vendor || "").trim();
    const customerEmail = String(payload.customerEmail || "").trim();
    if (!vendor || !customerEmail) {
      return NextResponse.json({ error: "Vendor and customer email are required." }, { status: 400 });
    }
    const now = new Date().toISOString();
    const orderId = `manual-${Date.now()}`;
    const next: AdminOrderRow = {
      id: orderId,
      orderRef: String(payload.orderRef || `MANUAL-${Date.now()}`),
      vendor,
      status: String(payload.status || "draft"),
      customerName: String(payload.customerName || "Customer"),
      customerEmail,
      mobile: String(payload.mobile || "-"),
      address: String(payload.address || "-"),
      street: String(payload.street || "-"),
      area: String(payload.area || "-"),
      city: String(payload.city || "-"),
      state: String(payload.state || "-"),
      pincode: String(payload.pincode || "-"),
      vendorAmount: Number(payload.vendorAmount || 0),
      totalPrice: Number(payload.totalPrice || 0),
      createdAt: String(payload.createdAt || now),
    };
    const overrides = await readOverrides();
    overrides.manualOrders.push(next);
    await writeOverrides(overrides);
    return NextResponse.json({ ok: true, order: next });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to create order.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const auth = requireSession(request, "admin");
  if (auth.error) return auth.error;
  try {
    const payload = (await request.json()) as { id?: string; patch?: Partial<AdminOrderRow> };
    const id = String(payload.id || "").trim();
    if (!id) return NextResponse.json({ error: "Order id is required." }, { status: 400 });
    const patch = payload.patch || {};
    const overrides = await readOverrides();
    const manualIndex = overrides.manualOrders.findIndex((row) => row.id === id);
    if (manualIndex >= 0) {
      overrides.manualOrders[manualIndex] = { ...overrides.manualOrders[manualIndex], ...patch, id };
      await writeOverrides(overrides);
      return NextResponse.json({ ok: true, order: overrides.manualOrders[manualIndex] });
    }
    overrides.edits[id] = { ...(overrides.edits[id] || {}), ...patch, id };
    await writeOverrides(overrides);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to update order.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const auth = requireSession(request, "admin");
  if (auth.error) return auth.error;
  try {
    const url = new URL(request.url);
    const id = String(url.searchParams.get("id") || "").trim();
    if (!id) return NextResponse.json({ error: "Order id is required." }, { status: 400 });
    const overrides = await readOverrides();
    const manualIndex = overrides.manualOrders.findIndex((row) => row.id === id);
    if (manualIndex >= 0) {
      overrides.manualOrders.splice(manualIndex, 1);
    } else if (!overrides.hiddenIds.includes(id)) {
      overrides.hiddenIds.push(id);
    }
    await writeOverrides(overrides);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to delete order.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

import "server-only";
import fs from "fs/promises";
import path from "path";

export type VendorSheetAccessRequestStatus = "pending" | "approved" | "rejected";

export type VendorSheetAccessRequest = {
  id: string;
  vendorId: string;
  vendorEmail: string;
  requestedGoogleEmail: string;
  sheetId: string;
  sheetName: string;
  sheetUrl: string;
  status: VendorSheetAccessRequestStatus;
  createdAt: string;
  updatedAt: string;
  note?: string;
};

const requestsPath = path.join(process.cwd(), "data", "vendor-sheet-access-requests.json");

export async function listVendorSheetAccessRequests(): Promise<VendorSheetAccessRequest[]> {
  try {
    const raw = await fs.readFile(requestsPath, "utf8");
    const parsed = JSON.parse(raw) as VendorSheetAccessRequest[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function saveVendorSheetAccessRequests(items: VendorSheetAccessRequest[]) {
  await fs.mkdir(path.dirname(requestsPath), { recursive: true });
  await fs.writeFile(requestsPath, JSON.stringify(items, null, 2), "utf8");
}

export async function createVendorSheetAccessRequest(input: {
  vendorId: string;
  vendorEmail: string;
  requestedGoogleEmail: string;
  sheetId: string;
  sheetName: string;
  sheetUrl: string;
}) {
  const items = await listVendorSheetAccessRequests();
  const now = new Date().toISOString();
  const normalizedEmail = String(input.requestedGoogleEmail || "").trim().toLowerCase();
  const existingPending = items.find(
    (r) =>
      r.vendorId === input.vendorId &&
      r.requestedGoogleEmail === normalizedEmail &&
      r.sheetId === input.sheetId &&
      r.status === "pending"
  );
  if (existingPending) return existingPending;
  const next: VendorSheetAccessRequest = {
    id: `vsar_${Math.random().toString(36).slice(2, 10)}`,
    vendorId: input.vendorId,
    vendorEmail: String(input.vendorEmail || "").trim().toLowerCase(),
    requestedGoogleEmail: normalizedEmail,
    sheetId: String(input.sheetId || "").trim(),
    sheetName: String(input.sheetName || "").trim(),
    sheetUrl: String(input.sheetUrl || "").trim(),
    status: "pending",
    createdAt: now,
    updatedAt: now,
  };
  items.unshift(next);
  await saveVendorSheetAccessRequests(items);
  return next;
}

export async function updateVendorSheetAccessRequestStatus(
  id: string,
  status: VendorSheetAccessRequestStatus,
  note?: string
) {
  const items = await listVendorSheetAccessRequests();
  const idx = items.findIndex((r) => r.id === id);
  if (idx < 0) throw new Error("Access request not found.");
  items[idx] = {
    ...items[idx],
    status,
    note: note || items[idx].note,
    updatedAt: new Date().toISOString(),
  };
  await saveVendorSheetAccessRequests(items);
  return items[idx];
}


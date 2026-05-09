import "server-only";
import fs from "fs/promises";
import path from "path";
import { CatalogProduct } from "@/lib/catalog";

export type VendorSheetApprovalStatus = "draft" | "pending_approval" | "approved" | "rejected";

export type VendorSheetApprovalEntry = {
  id: string;
  vendorId: string;
  vendorEmail: string;
  sheetId: string;
  sheetName: string;
  sheetUrl: string;
  productId: number;
  productTitle: string;
  productHandle: string;
  status: VendorSheetApprovalStatus;
  source: "google_sheet";
  createdAt: string;
  updatedAt: string;
  previousProduct: CatalogProduct | null;
  syncedProduct: CatalogProduct;
  lastActionNote?: string;
};

const approvalsPath = path.join(process.cwd(), "data", "vendor-sheet-approvals.json");

export async function listVendorSheetApprovals(): Promise<VendorSheetApprovalEntry[]> {
  try {
    const raw = await fs.readFile(approvalsPath, "utf8");
    const parsed = JSON.parse(raw) as VendorSheetApprovalEntry[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function saveVendorSheetApprovals(entries: VendorSheetApprovalEntry[]) {
  await fs.mkdir(path.dirname(approvalsPath), { recursive: true });
  await fs.writeFile(approvalsPath, JSON.stringify(entries, null, 2), "utf8");
}

export async function upsertVendorSheetApproval(input: {
  vendorId: string;
  vendorEmail: string;
  sheetId: string;
  sheetName: string;
  sheetUrl: string;
  productId: number;
  productTitle: string;
  productHandle: string;
  previousProduct: CatalogProduct | null;
  syncedProduct: CatalogProduct;
}) {
  const entries = await listVendorSheetApprovals();
  const now = new Date().toISOString();
  const idx = entries.findIndex((e) => e.vendorId === input.vendorId && e.productId === input.productId);
  const next: VendorSheetApprovalEntry = {
    id: idx >= 0 ? entries[idx].id : `vsap_${Math.random().toString(36).slice(2, 10)}`,
    vendorId: input.vendorId,
    vendorEmail: input.vendorEmail,
    sheetId: input.sheetId,
    sheetName: input.sheetName,
    sheetUrl: input.sheetUrl,
    productId: input.productId,
    productTitle: input.productTitle,
    productHandle: input.productHandle,
    status: "pending_approval",
    source: "google_sheet",
    createdAt: idx >= 0 ? entries[idx].createdAt : now,
    updatedAt: now,
    previousProduct: input.previousProduct,
    syncedProduct: input.syncedProduct,
    lastActionNote: "Pending admin approval",
  };
  if (idx >= 0) entries[idx] = next;
  else entries.unshift(next);
  await saveVendorSheetApprovals(entries);
  return next;
}

export async function updateVendorSheetApprovalStatus(
  id: string,
  status: VendorSheetApprovalStatus,
  note?: string
) {
  const entries = await listVendorSheetApprovals();
  const idx = entries.findIndex((e) => e.id === id);
  if (idx < 0) throw new Error("Approval entry not found.");
  entries[idx] = {
    ...entries[idx],
    status,
    updatedAt: new Date().toISOString(),
    lastActionNote: note || entries[idx].lastActionNote,
  };
  await saveVendorSheetApprovals(entries);
  return entries[idx];
}


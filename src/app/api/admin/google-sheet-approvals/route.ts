import { NextResponse } from "next/server";
import { requireSession } from "@/lib/sessionGuard";
import {
  listVendorSheetApprovals,
  updateVendorSheetApprovalStatus,
} from "@/lib/vendorSheetApprovals";
import { deleteCatalogProduct, replaceCatalogProduct } from "@/lib/catalog";
import { getVendorByEmail, getVendorPortalData } from "@/lib/vendorPortal";

export async function GET(request: Request) {
  const auth = requireSession(request, "admin");
  if (auth.error) return auth.error;
  const approvals = await listVendorSheetApprovals();
  return NextResponse.json({ ok: true, approvals });
}

export async function POST(request: Request) {
  const auth = requireSession(request, "admin");
  if (auth.error) return auth.error;
  try {
    const payload = (await request.json()) as {
      action?: "approve" | "reject";
      approvalId?: string;
    };
    const action = String(payload?.action || "");
    const approvalId = String(payload?.approvalId || "").trim();
    if (!approvalId) return NextResponse.json({ error: "approvalId is required." }, { status: 400 });

    const approvals = await listVendorSheetApprovals();
    const entry = approvals.find((item) => item.id === approvalId);
    if (!entry) return NextResponse.json({ error: "Approval not found." }, { status: 404 });

    if (action === "approve") {
      const vendorByEmail = await getVendorByEmail(entry.vendorEmail);
      const portal = await getVendorPortalData();
      const vendor = vendorByEmail || portal.vendors.find((v) => v.id === entry.vendorId) || null;
      const approvedMetafields = (entry.syncedProduct.metafields || []).filter(
        (m) => !(m.namespace === "integration" && m.key === "approval_status")
      );
      if (vendor?.id) {
        approvedMetafields.push({
          namespace: "vendor",
          key: "vendor_id",
          value: vendor.id,
          type: "single_line_text_field",
        });
      }
      approvedMetafields.push({
        namespace: "integration",
        key: "approval_status",
        value: "approved",
        type: "single_line_text_field",
      });
      await replaceCatalogProduct(entry.productId, {
        ...entry.syncedProduct,
        status: "active",
        vendor: vendor?.name || entry.syncedProduct.vendor || entry.vendorEmail,
        metafields: approvedMetafields,
      });
      const updated = await updateVendorSheetApprovalStatus(approvalId, "approved", "Approved by admin.");
      return NextResponse.json({ ok: true, approval: updated });
    }

    if (action === "reject") {
      await deleteCatalogProduct(entry.productId);
      const updated = await updateVendorSheetApprovalStatus(approvalId, "rejected", "Rejected by admin.");
      return NextResponse.json({ ok: true, approval: updated });
    }

    return NextResponse.json({ error: "Invalid action." }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to update approval.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

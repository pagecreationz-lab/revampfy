import { NextResponse } from "next/server";
import { requireSession } from "@/lib/sessionGuard";
import { getVendorByEmail } from "@/lib/vendorPortal";
import { getOrdersByVendor } from "@/lib/catalog";

export async function GET(request: Request) {
  const auth = requireSession(request, "vendor");
  if (auth.error) return auth.error;

  const vendor = await getVendorByEmail(auth.session!.email);
  if (!vendor) {
    return NextResponse.json({ error: "Vendor account not found." }, { status: 404 });
  }

  try {
    const orders = await getOrdersByVendor(vendor.name, 30);
    const grossAmount = orders.reduce((sum, order) => sum + Number(order.vendorAmount || 0), 0);
    const commissionPercent = Number(vendor.commissionPercent || 0);
    const commissionAmount = (grossAmount * commissionPercent) / 100;
    const creditBalance = Math.max(0, grossAmount - commissionAmount);
    return NextResponse.json({
      ok: true,
      vendor: vendor.name,
      orders,
      summary: {
        grossAmount,
        commissionPercent,
        commissionAmount,
        creditBalance,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load vendor orders.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}


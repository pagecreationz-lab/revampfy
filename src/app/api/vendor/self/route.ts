import { NextResponse } from "next/server";
import { requireSession } from "@/lib/sessionGuard";
import {
  getVendorByEmail,
  getVendorPortalData,
  getVendorStores,
  saveVendorPortalData,
} from "@/lib/vendorPortal";

export async function GET(request: Request) {
  const auth = requireSession(request, "vendor");
  if (auth.error) return auth.error;

  const vendor = await getVendorByEmail(auth.session!.email);
  if (!vendor) {
    return NextResponse.json({ error: "Vendor account not found." }, { status: 404 });
  }

  const stores = await getVendorStores(vendor.id);
  return NextResponse.json({ ok: true, vendor, stores });
}

export async function PATCH(request: Request) {
  const auth = requireSession(request, "vendor");
  if (auth.error) return auth.error;

  try {
    const payload = await request.json();
    const vendor = await getVendorByEmail(auth.session!.email);
    if (!vendor) {
      return NextResponse.json({ error: "Vendor account not found." }, { status: 404 });
    }

    const data = await getVendorPortalData();
    const vendorIndex = data.vendors.findIndex((item) => item.id === vendor.id);
    if (vendorIndex < 0) {
      return NextResponse.json({ error: "Vendor account not found." }, { status: 404 });
    }

    const safeStates = Array.isArray(payload?.states)
      ? payload.states.map((state: unknown) => String(state || "").trim()).filter(Boolean)
      : data.vendors[vendorIndex].states;

    data.vendors[vendorIndex] = {
      ...data.vendors[vendorIndex],
      name: String(payload?.name || data.vendors[vendorIndex].name).trim(),
      states: safeStates,
    };

    const updated = await saveVendorPortalData(data);
    const updatedVendor = updated.vendors.find((item) => item.id === vendor.id) || data.vendors[vendorIndex];
    const stores = updated.stores.filter((store) => store.vendorId === vendor.id);

    return NextResponse.json({ ok: true, vendor: updatedVendor, stores });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to update vendor profile.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

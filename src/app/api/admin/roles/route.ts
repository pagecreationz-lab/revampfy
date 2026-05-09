import { NextResponse } from "next/server";
import { getAdminUsers } from "@/lib/auth";
import { getCustomerUsers } from "@/lib/customerData";
import { getVendorPortalData, saveVendorPortalData } from "@/lib/vendorPortal";
import { getRoleAssignments, setRoleAssignment, type PortalRole } from "@/lib/roleAssignments";

export async function GET() {
  try {
    const [customers, vendorPortal, assignments] = await Promise.all([
      getCustomerUsers(),
      getVendorPortalData(),
      getRoleAssignments(),
    ]);
    const adminUsers = getAdminUsers();
    const assignmentMap = new Map(assignments.map((item) => [item.email, item.role]));
    const accounts = [
      ...customers.map((user) => ({
        email: user.email,
        name: user.name || "Customer User",
        source: "users",
        role: assignmentMap.get(user.email.toLowerCase()) || "user",
      })),
      ...vendorPortal.vendors.map((vendor) => ({
        email: vendor.email,
        name: vendor.name || "Vendor",
        source: "vendors",
        role: assignmentMap.get(vendor.email.toLowerCase()) || "vendor_admin",
      })),
      ...adminUsers.map((admin) => ({
        email: admin.email,
        name: admin.email,
        source: "admins",
        role: assignmentMap.get(admin.email.toLowerCase()) || "cms_admin",
      })),
    ];

    const uniqueMap = new Map<string, { email: string; name: string; source: string; role: string }>();
    for (const item of accounts) {
      uniqueMap.set(item.email.toLowerCase(), item);
    }

    return NextResponse.json({
      accounts: Array.from(uniqueMap.values()).sort((a, b) => a.email.localeCompare(b.email)),
      assignments,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load roles.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const payload = (await request.json()) as Record<string, unknown>;
    const email = String(payload.email || "").trim().toLowerCase();
    const role = String(payload.role || "").trim() as PortalRole;
    const saved = await setRoleAssignment(email, role);

    // Keep CMS vendor portal in sync with role assignment.
    if (role === "vendor_admin") {
      const vendorData = await getVendorPortalData();
      const exists = vendorData.vendors.some((vendor) => String(vendor.email || "").trim().toLowerCase() === email);
      if (!exists) {
        const localPart = email.split("@")[0] || "vendor";
        const label = localPart
          .split(/[._-]+/g)
          .filter(Boolean)
          .map((chunk) => chunk.charAt(0).toUpperCase() + chunk.slice(1))
          .join(" ") || "Vendor";
        vendorData.vendors.push({
          id: `vendor_${Math.random().toString(36).slice(2, 10)}`,
          name: label,
          code: label.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
          email,
          phone: "",
          contactPerson: "",
          businessName: "",
          address: "",
          city: "",
          state: "",
          pincode: "",
          passwordHash: "",
          states: [],
          isActive: true,
          commissionPercent: 10,
        });
        await saveVendorPortalData(vendorData);
      }
    }
    return NextResponse.json({ ok: true, assignment: saved });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to save role.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

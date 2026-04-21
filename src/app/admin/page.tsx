import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import AdminClient from "./AdminClient";
import { verifySessionToken } from "@/lib/auth";
import { getHomepageConfig } from "@/lib/homepage";

export default async function AdminPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get("pcgs_admin_session")?.value;
  const session = verifySessionToken(token);

  if (!session) {
    redirect("/admin-login?next=%2Fadmin");
  }
  if (session.role !== "admin") {
    redirect("/user-dashboard");
  }

  const config = await getHomepageConfig();

  return (
    <div className="admin container">
      <h1>PCGS Enterprises Admin</h1>
      <p className="hero__subtext">
        Manage CMS selections, sync Shopify entities (Categories, Brands, Vendors, Products),
        and edit content blocks for Home, Contact Us, About Us, Partners, and Store Locator.
      </p>
      <AdminClient initialConfig={config} />
    </div>
  );
}

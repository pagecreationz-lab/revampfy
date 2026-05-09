import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifySessionToken } from "@/lib/auth";
import VendorAdminClient from "./VendorAdminClient";

export default async function VendorAdminPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get("pcgs_admin_session")?.value;
  const session = verifySessionToken(token);

  if (!session) redirect("/vendor-login?next=%2Fvendor-admin");
  if (session.role !== "vendor") redirect("/login");

  return (
    <main className="container vendor-portal-shell" style={{ padding: "2rem 1rem" }}>
      <h1>Vendor Light Admin</h1>
      <p className="hero__subtext">Manage your profile and view your state-based store locations.</p>
      <VendorAdminClient />
    </main>
  );
}

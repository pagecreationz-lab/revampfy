import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifySessionToken } from "@/lib/auth";
import AdminLayoutShell from "./AdminLayoutShell";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const token = cookieStore.get("pcgs_admin_session")?.value;
  const session = verifySessionToken(token);

  if (!session) {
    redirect("/admin-login?next=%2Fadmin");
  }
  if (session.role !== "admin") {
    redirect("/user-dashboard");
  }

  return (
    <div className="admin container" style={{ padding: "1.25rem 0 1.75rem" }}>
      <AdminLayoutShell>{children}</AdminLayoutShell>
    </div>
  );
}

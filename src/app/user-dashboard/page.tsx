import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Header } from "@/components/Header";
import { Topbar } from "@/components/Topbar";
import { CustomerPortalClient } from "@/components/CustomerPortalClient";
import { verifySessionToken } from "@/lib/auth";

export default async function UserDashboardPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get("pcgs_admin_session")?.value;
  const session = verifySessionToken(token);

  if (!session) {
    redirect("/login?next=%2Fuser-dashboard");
  }

  if (session.role !== "customer") {
    redirect("/admin");
  }

  return (
    <>
      <Topbar />
      <Header />
      <main>
        <section className="section">
          <div className="container">
            <CustomerPortalClient email={session.email} />
          </div>
        </section>
      </main>
    </>
  );
}


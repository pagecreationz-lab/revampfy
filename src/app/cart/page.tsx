import { cookies } from "next/headers";
import { Header } from "@/components/Header";
import { Topbar } from "@/components/Topbar";
import { verifySessionToken } from "@/lib/auth";
import { CartClient } from "@/components/CartClient";

export default async function CartPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get("pcgs_admin_session")?.value;
  const session = verifySessionToken(token);

  return (
    <>
      <Topbar />
      <Header />
      <main>
        <CartClient isAuthenticated={Boolean(session)} />
      </main>
    </>
  );
}


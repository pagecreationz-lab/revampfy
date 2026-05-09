import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifySessionToken } from "@/lib/auth";
import VendorAdminClient from "../../VendorAdminClient";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function VendorProductEditPage({ params }: PageProps) {
  const { id } = await params;
  const productId = Number(id);

  const cookieStore = await cookies();
  const token = cookieStore.get("pcgs_admin_session")?.value;
  const session = verifySessionToken(token);

  if (!session) redirect("/vendor-login?next=%2Fvendor-admin");
  if (session.role !== "vendor") redirect("/login");

  return (
    <main className="container" style={{ padding: "2rem 1rem" }}>
      <p style={{ marginBottom: "0.8rem" }}>
        <a href="/vendor-admin" className="vendor-admin__nav-btn is-active" style={{ display: "inline-flex", minWidth: 260, justifyContent: "center" }}>
          Back To Products
        </a>
      </p>
      <h1>Product Details</h1>
      <p className="hero__subtext">Title and unique ID are shown in the product editor below.</p>
      <VendorAdminClient focusProductId={Number.isFinite(productId) ? productId : null} editorOnly />
    </main>
  );
}

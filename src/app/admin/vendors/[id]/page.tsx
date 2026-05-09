import VendorsAdminClient from "../VendorsAdminClient";

type VendorDetailPageProps = {
  params: Promise<{ id: string }>;
};

export default async function VendorDetailPage({ params }: VendorDetailPageProps) {
  const { id } = await params;
  return (
    <main>
      <h1>Vendor Details</h1>
      <p className="hero__subtext">Edit only the selected vendor on this dedicated page.</p>
      <VendorsAdminClient detailVendorId={id} />
    </main>
  );
}

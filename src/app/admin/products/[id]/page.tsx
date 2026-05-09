import AdminClient from "../../AdminClient";

type ProductDetailPageProps = {
  params: Promise<{ id: string }>;
};

export default async function ProductDetailPage({ params }: ProductDetailPageProps) {
  const { id } = await params;
  return (
    <section>
      <h1>Product Details</h1>
      <p className="hero__subtext">Open and edit selected product details on this dedicated page.</p>
      <AdminClient detailProductId={id} />
    </section>
  );
}

import UsersAdminClient from "../UsersAdminClient";

type UserDetailPageProps = {
  params: Promise<{ email: string }>;
};

export default async function UserDetailPage({ params }: UserDetailPageProps) {
  const { email } = await params;
  return (
    <main>
      <h1>User Details</h1>
      <p className="hero__subtext">Open and manage selected user details on this dedicated page.</p>
      <UsersAdminClient detailEmail={decodeURIComponent(email)} />
    </main>
  );
}

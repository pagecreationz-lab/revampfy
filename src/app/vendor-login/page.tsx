import VendorLoginClient from "./VendorLoginClient";

export default async function VendorLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const params = await searchParams;
  const nextPath = typeof params?.next === "string" ? params.next : "/vendor-admin";

  return <VendorLoginClient nextPath={nextPath} />;
}

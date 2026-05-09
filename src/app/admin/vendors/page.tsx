import VendorsAdminClient from "./VendorsAdminClient";

export default function AdminVendorsPage() {
  return (
    <main>
      <h1>Vendor Portal Admin</h1>
      <p className="hero__subtext">
        Sync vendor list from catalog, map state-wise store locations, and manage vendor light-admin access.
      </p>
      <VendorsAdminClient />
    </main>
  );
}


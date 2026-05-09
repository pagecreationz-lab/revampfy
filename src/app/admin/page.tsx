import AdminClient from "./AdminClient";

export default function AdminPage() {
  return (
    <section>
      <h1>PCGS Enterprises Admin</h1>
      <p className="hero__subtext">
        Manage standalone ecommerce data directly from CMS admin: products, variants,
        users, vendors, and content.
      </p>
      <AdminClient />
    </section>
  );
}


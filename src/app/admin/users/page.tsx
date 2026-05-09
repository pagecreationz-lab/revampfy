import UsersAdminClient from "./UsersAdminClient";

export default function AdminUsersPage() {
  return (
    <main>
      <h1>Users Admin</h1>
      <p className="hero__subtext">
        Create, edit, and delete customer users directly from CMS admin.
      </p>
      <UsersAdminClient />
    </main>
  );
}

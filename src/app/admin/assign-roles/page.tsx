import AssignRolesClient from "./AssignRolesClient";

export default function AssignRolesPage() {
  return (
    <main>
      <h1>Assign Roles</h1>
      <p className="hero__subtext">Assign portal access role for each account.</p>
      <AssignRolesClient />
    </main>
  );
}

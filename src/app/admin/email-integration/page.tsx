import EmailIntegrationAdminClient from "./EmailIntegrationAdminClient";

export default function AdminEmailIntegrationPage() {
  return (
    <main>
      <h1>Email Integration</h1>
      <p className="hero__subtext">
        Configure SMTP and auto-replies for contact and bulk enquiry forms from CMS admin.
      </p>
      <EmailIntegrationAdminClient />
    </main>
  );
}

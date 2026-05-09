import IntegrationsAdminClient from "./IntegrationsAdminClient";

export default function IntegrationsAdminPage() {
  return (
    <main>
      <h1>n8n Integrations</h1>
      <p className="hero__subtext">
        Configure n8n API access and Google Sheets OAuth/import from CMS Admin.
      </p>
      <IntegrationsAdminClient />
    </main>
  );
}


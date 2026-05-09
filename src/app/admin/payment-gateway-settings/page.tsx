import PaymentGatewaySettingsClient from "./PaymentGatewaySettingsClient";

export default function PaymentGatewaySettingsPage() {
  return (
    <main>
      <h1>Payment Gateway Settings</h1>
      <p className="hero__subtext">Manage Razorpay, PayU, COD, and Shiprocket integration settings.</p>
      <PaymentGatewaySettingsClient />
    </main>
  );
}

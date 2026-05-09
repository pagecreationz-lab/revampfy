import OrdersAdminClient from "./OrdersAdminClient";

export default function AdminOrdersPage() {
  return (
    <main>
      <h1>Orders</h1>
      <p className="hero__subtext">
        Orders placed by users and captured in vendor order flow.
      </p>
      <OrdersAdminClient />
    </main>
  );
}


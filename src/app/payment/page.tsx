import { Suspense } from "react";
import { Header } from "@/components/Header";
import { Topbar } from "@/components/Topbar";
import { PaymentClient } from "@/components/PaymentClient";

export default function PaymentPage() {
  return (
    <>
      <Topbar />
      <Header />
      <main>
        <Suspense fallback={null}>
          <PaymentClient />
        </Suspense>
      </main>
    </>
  );
}


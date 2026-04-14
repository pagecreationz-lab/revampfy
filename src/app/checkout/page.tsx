import { Suspense } from "react";
import { Header } from "@/components/Header";
import { Topbar } from "@/components/Topbar";
import { CheckoutClient } from "@/components/CheckoutClient";

export default function CheckoutPage() {
  return (
    <>
      <Topbar />
      <Header />
      <main>
        <Suspense fallback={null}>
          <CheckoutClient />
        </Suspense>
      </main>
    </>
  );
}

import { Header } from "@/components/Header";
import { Topbar } from "@/components/Topbar";
import { CompareClient } from "@/components/CompareClient";

export default function ComparePage() {
  return (
    <>
      <Topbar />
      <Header />
      <main>
        <CompareClient />
      </main>
    </>
  );
}


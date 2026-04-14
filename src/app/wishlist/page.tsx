import { Header } from "@/components/Header";
import { Topbar } from "@/components/Topbar";
import { WishlistClient } from "@/components/WishlistClient";

export default function WishlistPage() {
  return (
    <>
      <Topbar />
      <Header />
      <main>
        <WishlistClient />
      </main>
    </>
  );
}


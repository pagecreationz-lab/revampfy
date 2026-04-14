import type { Metadata } from "next";
import { Space_Grotesk, Sora } from "next/font/google";
import { FloatingContact } from "@/components/FloatingContact";
import { ThemeModeScript } from "@/components/ThemeModeScript";
import { getSiteContent } from "@/lib/siteContent";
import "./globals.css";

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
});

const sora = Sora({
  variable: "--font-sora",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Revampfy | Refurbished Electronics",
  description:
    "Enterprise-grade refurbished laptops, desktops, and accessories with warranty and fast delivery.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const siteContent = await getSiteContent();
  const themeClass = siteContent.themeMode === "light" ? "theme-light" : "theme-dark";

  return (
    <html
      lang="en"
      className={`${spaceGrotesk.variable} ${sora.variable}`}
      suppressHydrationWarning
    >
      <body className={themeClass} suppressHydrationWarning>
        <ThemeModeScript defaultMode={siteContent.themeMode} />
        {children}
        <FloatingContact />
      </body>
    </html>
  );
}

import type { Metadata } from "next";
import { cookies } from "next/headers";
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
  const cookieStore = await cookies();
  const themeCookie = cookieStore.get("pcgs_theme_mode")?.value;
  const resolvedTheme =
    themeCookie === "light" || themeCookie === "dark" ? themeCookie : siteContent.themeMode;
  const themeClass = resolvedTheme === "light" ? "theme-light" : "theme-dark";

  return (
    <html
      lang="en"
      className={`${spaceGrotesk.variable} ${sora.variable} ${themeClass}`}
      data-theme={resolvedTheme}
      suppressHydrationWarning
    >
      <head>
        <link
          rel="preload"
          as="image"
          href="https://images.unsplash.com/photo-1498050108023-c5249f4df085?q=80&w=900&auto=format&fit=crop"
        />
      </head>
      <body className={themeClass} suppressHydrationWarning>
        <script
          dangerouslySetInnerHTML={{
            __html: `(()=>{try{var k='pcgs_theme_mode';var t=localStorage.getItem(k);if(t!=='light'&&t!=='dark'){t='${resolvedTheme}';}var h=document.documentElement;h.setAttribute('data-theme',t);h.classList.remove('theme-dark','theme-light');h.classList.add(t==='light'?'theme-light':'theme-dark');var b=document.body;if(b){b.classList.remove('theme-dark','theme-light');b.classList.add(t==='light'?'theme-light':'theme-dark');}}catch(e){}})();`,
          }}
        />
        <ThemeModeScript defaultMode={resolvedTheme} />
        {children}
        <FloatingContact />
      </body>
    </html>
  );
}

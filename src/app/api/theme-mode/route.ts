import { getSiteContent, saveSiteContent } from "@/lib/siteContent";
import type { SiteThemeMode } from "@/lib/siteContentSchema";
import { revalidatePath } from "next/cache";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const payload = (await request.json()) as { mode?: "light" | "dark" };
  const mode: SiteThemeMode = payload?.mode === "light" ? "light" : "dark";
  const content = await getSiteContent();
  const next = { ...content, themeMode: mode };
  await saveSiteContent(next);

  revalidatePath("/");
  revalidatePath("/about-us");
  revalidatePath("/partners");
  revalidatePath("/stores");
  revalidatePath("/contact-us");
  revalidatePath("/bulk-orders-enquiry");
  revalidatePath("/company");
  revalidatePath("/policies");
  revalidatePath("/store");

  return Response.json({ ok: true, mode });
}

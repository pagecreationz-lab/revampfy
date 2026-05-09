import fs from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";
import { requireSession } from "@/lib/sessionGuard";

export async function POST(request: Request) {
  const auth = requireSession(request, "vendor");
  if (auth.error) return auth.error;

  try {
    const form = await request.formData();
    const files = [...form.getAll("files"), form.get("file")].filter(Boolean);
    const uploadDir = path.join(process.cwd(), "public", "uploads", "vendor");
    await fs.mkdir(uploadDir, { recursive: true });

    const urls: string[] = [];
    for (const entry of files) {
      const file = entry as File;
      if (!file || typeof (file as any).arrayBuffer !== "function") continue;
      if (!String(file.type || "").startsWith("image/")) {
        return NextResponse.json({ error: "Only image uploads are allowed." }, { status: 400 });
      }
      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);
      const ext = path.extname(file.name) || ".jpg";
      const filename = `vendor-${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`;
      await fs.writeFile(path.join(uploadDir, filename), buffer);
      urls.push(`/uploads/vendor/${filename}`);
    }

    if (!urls.length) {
      return NextResponse.json({ error: "At least one image file is required." }, { status: 400 });
    }

    return NextResponse.json({ ok: true, urls });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Image upload failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

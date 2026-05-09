import { NextResponse } from "next/server";
import { requireSession } from "@/lib/sessionGuard";
import { getGoogleSheetsAccessToken } from "@/lib/adminIntegrations";

export async function GET(request: Request) {
  const auth = requireSession(request, "admin");
  if (auth.error) return auth.error;

  try {
    const token = await getGoogleSheetsAccessToken();
    const filesUrl =
      "https://www.googleapis.com/drive/v3/files?q=" +
      encodeURIComponent("mimeType='application/vnd.google-apps.spreadsheet' and trashed=false") +
      "&fields=files(id,name,webViewLink)&pageSize=100&orderBy=modifiedTime desc";
    const res = await fetch(filesUrl, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    const json = (await res.json().catch(() => ({}))) as {
      files?: Array<{ id?: string; name?: string; webViewLink?: string }>;
      error?: { message?: string };
    };
    if (!res.ok) {
      return NextResponse.json({ error: json?.error?.message || "Unable to list sheets." }, { status: 400 });
    }
    const sheets = Array.isArray(json.files)
      ? json.files.map((entry) => ({
          id: String(entry.id || ""),
          name: String(entry.name || ""),
          url: String(entry.webViewLink || ""),
        }))
      : [];
    return NextResponse.json({ ok: true, sheets });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to list sheets.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}


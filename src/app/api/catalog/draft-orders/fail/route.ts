import { readSessionFromRequest, verifySessionToken } from "@/lib/auth";
import { markDraftOrderFailed } from "@/lib/catalog";

export async function POST(request: Request) {
  const token = readSessionFromRequest(request);
  const session = verifySessionToken(token);
  if (!session) {
    return Response.json({ error: "Unauthorized. Please login." }, { status: 401 });
  }

  try {
    const payload = await request.json();
    const draftOrderId = Number(payload?.draftOrderId || 0);
    if (!Number.isFinite(draftOrderId) || draftOrderId <= 0) {
      return Response.json({ error: "Invalid draftOrderId." }, { status: 400 });
    }
    const result = await markDraftOrderFailed(draftOrderId);
    return Response.json({ ok: true, draft: result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to mark failed payment.";
    return Response.json({ error: message }, { status: 500 });
  }
}


import { readSessionFromRequest, verifySessionToken } from "@/lib/auth";

export async function GET(request: Request) {
  const token = readSessionFromRequest(request);
  const session = verifySessionToken(token);
  if (!session) {
    return Response.json({ authenticated: false }, { status: 401 });
  }
  return Response.json({ authenticated: true, session });
}

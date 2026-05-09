import { NextResponse } from "next/server";
import { readSessionFromRequest, verifySessionToken } from "@/lib/auth";

export function requireSession(request: Request, role?: string) {
  const token = readSessionFromRequest(request);
  const session = verifySessionToken(token);
  if (!session) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  if (role && session.role !== role) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { session };
}

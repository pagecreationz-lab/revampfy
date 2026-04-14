import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const isProtected =
    request.nextUrl.pathname.startsWith("/admin") ||
    request.nextUrl.pathname.startsWith("/user-dashboard") ||
    request.nextUrl.pathname.startsWith("/customer-portal") ||
    request.nextUrl.pathname.startsWith("/checkout");

  if (isProtected) {
    const token = request.cookies.get("pcgs_admin_session")?.value;
    if (!token) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("expired", "1");
      loginUrl.searchParams.set(
        "next",
        `${request.nextUrl.pathname}${request.nextUrl.search}`
      );
      return NextResponse.redirect(loginUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/admin/:path*",
    "/user-dashboard/:path*",
    "/customer-portal/:path*",
    "/checkout/:path*",
  ],
};

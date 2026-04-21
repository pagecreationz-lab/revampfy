import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const isAdminRoute = pathname.startsWith("/admin");
  const isProtected =
    isAdminRoute ||
    pathname.startsWith("/user-dashboard") ||
    pathname.startsWith("/customer-portal") ||
    pathname.startsWith("/checkout") ||
    pathname.startsWith("/payment");

  if (isProtected) {
    const token = request.cookies.get("pcgs_admin_session")?.value;
    if (!token) {
      const loginUrl = new URL(isAdminRoute ? "/admin-login" : "/login", request.url);
      loginUrl.searchParams.set("expired", "1");
      loginUrl.searchParams.set(
        "next",
        `${pathname}${request.nextUrl.search}`
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
    "/payment/:path*",
  ],
};

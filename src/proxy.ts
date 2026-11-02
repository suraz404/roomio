import { NextRequest, NextResponse } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

// Everything not listed here requires a session cookie (closed by default).
const publicRoutes = ["/", "/login", "/signup"];

// Optimistic check only: it looks for the cookie, not whether the session is
// valid. The real check stays in requireSession() / getApiSession().
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (publicRoutes.includes(pathname)) {
    return NextResponse.next();
  }

  if (!getSessionCookie(request)) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon  `.ico).*)"],
};

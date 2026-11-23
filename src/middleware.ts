import { NextResponse, type NextRequest } from "next/server";

// Cheap edge gate: no session cookie → login. Real session validation happens server-side on every request.
export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (pathname.startsWith("/login") || pathname.startsWith("/reset") || pathname.startsWith("/api") || pathname.startsWith("/_next") || pathname === "/favicon.ico") return NextResponse.next();
  if (!req.cookies.get("epm_session")) {
    const url = req.nextUrl.clone(); url.pathname = "/login"; url.search = `?next=${encodeURIComponent(pathname)}`;
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}
export const config = { matcher: ["/((?!_next/static|_next/image).*)"] };

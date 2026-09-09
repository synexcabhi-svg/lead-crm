/**
 * Edge middleware - the auth gate. Protects the admin UI and admin APIs, and
 * forces a password change on first login. PUBLIC routes (/, /login,
 * /public/*, /api/public/*, /api/auth/*) are open.
 */
import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify } from "jose";

const COOKIE_NAME = "crm_session";
const secret = new TextEncoder().encode(
  process.env.JWT_SECRET || "dev-insecure-secret-change-me-please-0000000000",
);

const PROTECTED_PAGES = ["/dashboard", "/leads", "/deals", "/accounts", "/territories", "/people"];
const PROTECTED_APIS = [
  "/api/leads",
  "/api/deals",
  "/api/accounts",
  "/api/territories",
  "/api/users",
  "/api/calls",
  "/api/dashboard",
  "/api/events",
  "/api/meta",
];

async function session(req: NextRequest): Promise<{ mcp: boolean } | null> {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret);
    return { mcp: payload.mcp === true };
  } catch {
    return null;
  }
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const needsAuth =
    PROTECTED_PAGES.some((p) => pathname === p || pathname.startsWith(p + "/")) ||
    PROTECTED_APIS.some((p) => pathname === p || pathname.startsWith(p + "/"));

  if (!needsAuth) return NextResponse.next();

  const sess = await session(req);
  if (!sess) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: { message: "Authentication required" } }, { status: 401 });
    }
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Force first-login password change (pages only; the change form calls its own API).
  if (sess.mcp && !pathname.startsWith("/api/")) {
    return NextResponse.redirect(new URL("/change-password", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/leads/:path*",
    "/deals/:path*",
    "/accounts/:path*",
    "/territories/:path*",
    "/people/:path*",
    "/api/leads/:path*",
    "/api/deals/:path*",
    "/api/accounts/:path*",
    "/api/territories/:path*",
    "/api/users/:path*",
    "/api/calls/:path*",
    "/api/dashboard/:path*",
    "/api/events",
    "/api/meta",
  ],
};

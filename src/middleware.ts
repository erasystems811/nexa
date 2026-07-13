import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import { resolveRoute, surfaceForHost, surfaceOrigin, homeForRole } from "@/lib/surfaces";
import type { UserRole } from "@/lib/db/types";

/**
 * Subdomain routing and role gating. Addendum v1.2 removes the Rider App as a
 * surface; /rider now redirects back to the marketplace while the legacy module
 * is being retired.
 */

const PROTECTED_PREFIXES: ReadonlyArray<{ prefix: string; roles: UserRole[] }> = [
  { prefix: "/admin", roles: ["admin"] },
  { prefix: "/studio", roles: ["provider"] },
  { prefix: "/account", roles: ["customer", "provider", "admin"] },
  { prefix: "/messages", roles: ["customer", "provider", "admin"] },
  { prefix: "/orders", roles: ["customer", "admin"] },
  { prefix: "/book", roles: ["customer", "admin"] },
];

const AUTH_ROUTES = ["/login", "/register"];

function carryCookies(from: NextResponse, to: NextResponse): NextResponse {
  for (const c of from.cookies.getAll()) to.cookies.set(c);
  return to;
}

function gate(
  internalPath: string,
  userId: string | null,
  role: UserRole | null,
  request: NextRequest,
  base: NextResponse,
): NextResponse | null {
  const guarded = PROTECTED_PREFIXES.find((p) => internalPath.startsWith(p.prefix));
  if (!guarded) return null;

  if (!userId) {
    const login = new URL("/login", request.url);
    login.searchParams.set("next", internalPath);
    return carryCookies(base, NextResponse.redirect(login));
  }
  if (!role || !guarded.roles.includes(role)) {
    return carryCookies(base, NextResponse.redirect(new URL(homeForRole(role ?? "customer"), request.url)));
  }
  return null;
}

export async function middleware(request: NextRequest) {
  const { response, userId, role } = await updateSession(request);
  const { pathname } = request.nextUrl;

  if (pathname === "/rider" || pathname.startsWith("/rider/")) {
    return carryCookies(response, NextResponse.redirect(new URL("/", request.url)));
  }

  const surface = surfaceForHost(request.headers.get("host"));

  if (!surface) {
    if (userId && AUTH_ROUTES.some((r) => pathname.startsWith(r))) {
      return carryCookies(response, NextResponse.redirect(new URL(homeForRole(role ?? "customer"), request.url)));
    }
    return gate(pathname, userId, role, request, response) ?? response;
  }

  const action = resolveRoute(surface, pathname);

  if (action.kind === "redirect") {
    const origin = surfaceOrigin(action.surface);
    return carryCookies(response, NextResponse.redirect(`${origin}${action.path}`));
  }
  if (action.kind === "notFound") {
    return carryCookies(response, NextResponse.redirect(`${surfaceOrigin(surface)}/`));
  }

  const internalPath = action.kind === "rewrite" ? action.to : pathname;

  if (userId && AUTH_ROUTES.some((r) => internalPath.startsWith(r))) {
    return carryCookies(response, NextResponse.redirect(new URL(homeForRole(role ?? "customer"), request.url)));
  }

  const blocked = gate(internalPath, userId, role, request, response);
  if (blocked) return blocked;

  if (action.kind === "rewrite") {
    const url = request.nextUrl.clone();
    url.pathname = internalPath;
    return carryCookies(response, NextResponse.rewrite(url));
  }
  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
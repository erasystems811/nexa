import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import { resolveRoute, surfaceForHost, surfaceOrigin, homeForRole } from "@/lib/surfaces";
import type { UserRole } from "@/lib/db/types";

/**
 * Two jobs, in order:
 *
 *   1. Subdomain routing (PRD Addendum §2). When a live root domain is
 *      configured, each subdomain shows only its own app: vendor -> Studio,
 *      rider -> Rider, admin -> Admin, bare root -> Marketplace. A path that
 *      belongs to another surface is redirected to its subdomain. This engages
 *      only under the real domain; on localhost or the Railway URL the app is
 *      single-domain and every surface is reachable by path, unchanged.
 *
 *   2. Role gating. Which role may open which surface. This is a UX boundary,
 *      not security — RLS (0011_rls.sql) is what actually stops a rider reading
 *      a provider's payouts, and it does not consult the URL.
 */

const PROTECTED_PREFIXES: ReadonlyArray<{ prefix: string; roles: UserRole[] }> = [
  { prefix: "/admin", roles: ["admin"] },
  { prefix: "/studio", roles: ["provider"] },
  { prefix: "/rider", roles: ["customer", "provider", "rider", "admin"] },
  { prefix: "/account", roles: ["customer", "provider", "rider", "admin"] },
  { prefix: "/messages", roles: ["customer", "provider", "admin"] },
  { prefix: "/orders", roles: ["customer", "admin"] },
  { prefix: "/book", roles: ["customer", "admin"] },
];

const AUTH_ROUTES = ["/login", "/register"];

/** Copy the session cookies set by updateSession onto a new response. */
function carryCookies(from: NextResponse, to: NextResponse): NextResponse {
  for (const c of from.cookies.getAll()) to.cookies.set(c);
  return to;
}

/** Role gate applied to an internal path. Returns a redirect response, or null. */
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
  const surface = surfaceForHost(request.headers.get("host"));

  // ----- Single-domain / dev mode (no root domain configured) --------------
  if (!surface) {
    if (userId && AUTH_ROUTES.some((r) => pathname.startsWith(r))) {
      return carryCookies(response, NextResponse.redirect(new URL(homeForRole(role ?? "customer"), request.url)));
    }
    return gate(pathname, userId, role, request, response) ?? response;
  }

  // ----- Live subdomain mode ----------------------------------------------
  const action = resolveRoute(surface, pathname);

  if (action.kind === "redirect") {
    const origin = surfaceOrigin(action.surface);
    return carryCookies(response, NextResponse.redirect(`${origin}${action.path}`));
  }
  if (action.kind === "notFound") {
    // The path is not part of this surface (e.g. /messages on the rider app).
    // Send them to this surface's own home rather than a dead 404.
    return carryCookies(response, NextResponse.redirect(`${surfaceOrigin(surface)}/`));
  }

  const internalPath = action.kind === "rewrite" ? action.to : pathname;

  // Already signed in and visiting a login/register page → go to your app home.
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

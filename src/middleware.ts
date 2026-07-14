import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import { resolveRoute, surfaceForHost, surfaceOrigin, homeForRole } from "@/lib/surfaces";
import type { UserRole } from "@/lib/db/types";

/**
 * Subdomain routing and role gating. Nexa has three surfaces: the customer
 * marketplace, Business Studio (vendor.), and the Admin Console (admin.).
 */

const PROTECTED_PREFIXES: ReadonlyArray<{ prefix: string; roles: UserRole[] }> = [
  { prefix: "/admin", roles: ["admin"] },
  { prefix: "/studio", roles: ["provider"] },
  { prefix: "/account", roles: ["customer", "provider", "admin"] },
  { prefix: "/whatsapp", roles: ["customer", "provider", "admin"] },
  { prefix: "/orders", roles: ["customer", "admin"] },
  { prefix: "/book", roles: ["customer", "admin"] },
];

const AUTH_ROUTES = ["/login", "/register", "/verify", "/reset"];

/**
 * What someone who is not a vendor sees on the vendor surface. Not a redirect:
 * bouncing an admin from /vendor into the Admin Console — which is what used to
 * happen, because homeForRole("admin") is the Admin Console — is baffling, and
 * bouncing a signed-out visitor to /login tells them nothing about how to join.
 */
const NOT_A_VENDOR_PATH = "/vendor-access";

function carryCookies(from: NextResponse, to: NextResponse): NextResponse {
  for (const c of from.cookies.getAll()) to.cookies.set(c);
  return to;
}

function pathRemainder(pathname: string, prefix: string): string {
  if (pathname === prefix) return "/";
  return pathname.slice(prefix.length) || "/";
}

function cleanSurfacePath(request: NextRequest, response: NextResponse, surface: ReturnType<typeof surfaceForHost>): NextResponse | null {
  const { pathname } = request.nextUrl;
  const target = pathname === "/admin" || pathname.startsWith("/admin/")
    ? { surface: "admin" as const, remainder: pathRemainder(pathname, "/admin") }
    : pathname === "/studio" || pathname.startsWith("/studio/")
      ? { surface: "studio" as const, remainder: pathRemainder(pathname, "/studio") }
      : null;

  if (!target) return null;

  if (surface === target.surface) {
    return carryCookies(response, NextResponse.redirect(new URL(target.remainder, request.url)));
  }

  const origin = surfaceOrigin(target.surface);
  if (origin) return carryCookies(response, NextResponse.redirect(`${origin}${target.remainder}`));

  // Single-domain (dev, and the raw Railway URL): there are no subdomains to send
  // anyone to, so the surfaces live at their paths. /vendor is the name people
  // type; /studio is where it lives. Sending them home instead — which is what
  // this did — is how "/vendor" became a dead end.
  if (pathname === "/vendor" || pathname.startsWith("/vendor/")) {
    const to = target.remainder === "/" ? "/studio" : `/studio${target.remainder}`;
    return carryCookies(response, NextResponse.redirect(new URL(to, request.url)));
  }
  return null;
}

function notAVendor(request: NextRequest, base: NextResponse): NextResponse {
  const url = request.nextUrl.clone();
  url.pathname = NOT_A_VENDOR_PATH;
  url.search = "";
  return carryCookies(base, NextResponse.rewrite(url));
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

  // Business Studio is the one surface a stranger is *meant* to arrive at
  // without an account — they came to become a vendor. Explain, do not redirect.
  if (guarded.prefix === "/studio" && (!userId || role !== "provider")) {
    return notAVendor(request, base);
  }

  if (!userId) {
    const login = new URL("/login", request.url);
    const hostSurface = surfaceForHost(request.headers.get("host"));
    if (!(guarded.prefix === "/admin" && hostSurface === "admin")) {
      login.searchParams.set("next", internalPath);
    }
    return carryCookies(base, NextResponse.redirect(login));
  }
  if (!role || !guarded.roles.includes(role)) {
    if (guarded.prefix === "/admin") {
      const login = new URL("/login", request.url);
      login.searchParams.set("next", "/admin");
      return carryCookies(base, NextResponse.redirect(login));
    }
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
  const cleanPathRedirect = cleanSurfacePath(request, response, surface);
  if (cleanPathRedirect) return cleanPathRedirect;

  if (!surface) {
    const wantsAdmin = request.nextUrl.searchParams.get("next")?.startsWith("/admin") === true;
    if (userId && AUTH_ROUTES.some((r) => pathname.startsWith(r)) && !(wantsAdmin && role !== "admin")) {
      return carryCookies(response, NextResponse.redirect(new URL(homeForRole(role ?? "customer"), request.url)));
    }
    return gate(pathname, userId, role, request, response) ?? response;
  }

  if (surface === "admin" && pathname === "/register") {
    const login = new URL("/login", request.url);
    return carryCookies(response, NextResponse.redirect(login));
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
    const wantsAdmin = surface === "admin" || request.nextUrl.searchParams.get("next")?.startsWith("/admin") === true;
    if (!(wantsAdmin && role !== "admin")) {
      return carryCookies(response, NextResponse.redirect(new URL(homeForRole(role ?? "customer"), request.url)));
    }
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

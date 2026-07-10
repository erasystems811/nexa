import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import type { UserRole } from "@/lib/db/types";

/**
 * Which role may open which surface. PRD Section 02: four applications, one
 * backend.
 *
 * This is routing, not security. A rider who forges a cookie past this check
 * still cannot read a provider's payouts, because RLS (0011_rls.sql) does not
 * consult the URL. Both layers exist; only one of them is load-bearing.
 */
const PROTECTED_PREFIXES: ReadonlyArray<{ prefix: string; roles: UserRole[] }> = [
  { prefix: "/admin", roles: ["admin"] },
  { prefix: "/studio", roles: ["provider"] },
  { prefix: "/rider", roles: ["rider"] },
  { prefix: "/account", roles: ["customer", "provider", "rider", "admin"] },
  // Messaging is shared by the Marketplace and Business Studio (PRD Section 08),
  // so it is not nested under either surface. RLS decides which conversations
  // each of them can see.
  { prefix: "/messages", roles: ["customer", "provider", "admin"] },
];

const AUTH_ROUTES = ["/login", "/register"];

function homePathForRole(role: UserRole | null): string {
  switch (role) {
    case "admin":
      return "/admin";
    case "provider":
      return "/studio";
    case "rider":
      return "/rider";
    default:
      return "/";
  }
}

export async function middleware(request: NextRequest) {
  const { response, userId, role } = await updateSession(request);
  const { pathname } = request.nextUrl;

  if (userId && AUTH_ROUTES.some((r) => pathname.startsWith(r))) {
    return NextResponse.redirect(new URL(homePathForRole(role), request.url));
  }

  const guarded = PROTECTED_PREFIXES.find((p) => pathname.startsWith(p.prefix));
  if (!guarded) return response;

  if (!userId) {
    const login = new URL("/login", request.url);
    login.searchParams.set("next", pathname);
    return NextResponse.redirect(login);
  }

  if (!role || !guarded.roles.includes(role)) {
    return NextResponse.redirect(new URL(homePathForRole(role), request.url));
  }

  return response;
}

export const config = {
  matcher: [
    // Everything except static assets and image files. The session refresh has
    // to run broadly or the auth cookie expires under a user mid-navigation.
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};

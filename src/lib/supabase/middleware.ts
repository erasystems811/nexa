import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { publicEnv } from "@/lib/env";
import { cookieDomain } from "@/lib/surfaces";
import type { Database } from "@/lib/db/types";
import type { UserRole } from "@/lib/db/types";

export interface SessionContext {
  response: NextResponse;
  userId: string | null;
  role: UserRole | null;
}

/**
 * Refreshes the auth cookie and reports who the caller is.
 *
 * `getUser` — not `getSession` — because getSession trusts whatever is in
 * the cookie, and the cookie is attacker-controlled. getUser revalidates the
 * JWT against Supabase.
 */
export async function updateSession(request: NextRequest): Promise<SessionContext> {
  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          // In live (subdomain) mode the session cookie is scoped to the parent
          // domain so it spans nexa / vendor / rider / admin. In dev it stays
          // host-only.
          const domain = cookieDomain();
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, domain ? { ...options, domain } : options);
          }
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // The role is mirrored onto app_metadata by a DB trigger (0002_identity.sql)
  // so the middleware can authorise a route without a database round-trip.
  // It lags by one token refresh after an admin changes someone's role; page-
  // level checks re-read it, and RLS is the real boundary regardless.
  let role = (user?.app_metadata?.role as UserRole | undefined) ?? null;

  if (user && !role) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();
    role = profile?.role ?? null;
  }

  return { response, userId: user?.id ?? null, role };
}

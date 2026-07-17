import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies, headers } from "next/headers";
import { publicEnv } from "@/lib/env";
import { authCookieName, cookieDomain, surfaceForHost } from "@/lib/surfaces";
import type { Database } from "@/lib/db/types";

/**
 * Request-scoped client carrying the caller's session. Every query it makes is
 * subject to RLS — this is the client almost all app code should use.
 *
 * The session is read from the cookie named for THIS surface, so the customer
 * app reads only customer sessions, the vendor app only vendor sessions, and so
 * on. The three apps cannot see each other's logins.
 */
export async function createClient() {
  const cookieStore = await cookies();
  const host = (await headers()).get("host");
  const cookieName = authCookieName(surfaceForHost(host));

  return createServerClient<Database>(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookieOptions: { name: cookieName },
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            const domain = cookieDomain();
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, domain ? { ...options, domain } : options);
            }
          } catch {
            // Server Components cannot set cookies. The middleware refreshes the
            // session on every request, so ignoring this is safe.
          }
        },
      },
    },
  );
}

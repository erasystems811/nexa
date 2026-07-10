import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { publicEnv } from "@/lib/env";
import { cookieDomain } from "@/lib/surfaces";
import type { Database } from "@/lib/db/types";

/**
 * Request-scoped client carrying the caller's session. Every query it makes is
 * subject to RLS — this is the client almost all app code should use.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
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

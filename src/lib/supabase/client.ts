"use client";

import { createBrowserClient } from "@supabase/ssr";
import { publicEnv } from "@/lib/env";
import { cookieDomain } from "@/lib/surfaces";
import type { Database } from "@/lib/db/types";

export function createClient() {
  const domain = cookieDomain();
  return createBrowserClient<Database>(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    // In live mode the browser writes the session to the parent domain too, so
    // a token refresh on one subdomain stays valid across all of them.
    domain ? { cookieOptions: { domain } } : undefined,
  );
}

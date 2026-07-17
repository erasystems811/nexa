"use client";

import { createBrowserClient } from "@supabase/ssr";
import { publicEnv } from "@/lib/env";
import { authCookieName, cookieDomain, surfaceForHost } from "@/lib/surfaces";
import type { Database } from "@/lib/db/types";

export function createClient() {
  const domain = cookieDomain();
  // The cookie name is per surface, so the browser reads and writes only THIS
  // app's session — a vendor session never becomes visible on the customer app,
  // even when both are served from one host.
  const surface = typeof window === "undefined" ? null : surfaceForHost(window.location.host);
  const name = authCookieName(surface);
  return createBrowserClient<Database>(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { cookieOptions: domain ? { name, domain } : { name } },
  );
}

import "server-only";

import { createClient } from "@supabase/supabase-js";
import { publicEnv } from "@/lib/env";
import type { Database } from "@/lib/db/types";

/**
 * Anon-key client carrying no cookies/session. Every table this is meant for
 * (`listings_public_read`, `providers`, `categories`, `cities`) grants
 * `to anon, authenticated` with no `auth.uid()` in the policy body — the
 * result is identical for every visitor. That's what makes it safe to wrap
 * reads through this client in `unstable_cache`: unlike `server.ts`'s
 * cookie-bound client (which forces the whole route dynamic per request),
 * this one never touches `cookies()`/`headers()`, so Next.js can actually
 * cache it.
 *
 * Only use this for public marketplace reads. Anything that must reflect who
 * is asking — an authenticated customer's own bookings, a vendor's own
 * listings including unapproved ones — still goes through `server.ts`.
 */
export function createPublicClient() {
  return createClient<Database>(publicEnv.NEXT_PUBLIC_SUPABASE_URL, publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

import "server-only";

import { createClient } from "@supabase/supabase-js";
import { publicEnv } from "@/lib/env";
import { serverEnv } from "@/lib/env";
import type { Database } from "@/lib/db/types";

/**
 * Service-role client. Bypasses RLS entirely.
 *
 * Use only where the platform itself is the actor and no user session can be
 * trusted to authorise the write: the payments service moving money, the
 * bookings state machine, gateway webhooks. Never in a route that renders
 * user-controlled input, and never in a client component.
 *
 * The guard triggers in 0011_rls.sql are written to let this client through by
 * checking `auth.uid is null` — which is precisely what a service-role
 * connection looks like. Calling this from a user request thereby hands that
 * request the platform's authority. Don't.
 */
export function createAdminClient() {
  return createClient<Database>(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    serverEnv().SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: { autoRefreshToken: false, persistSession: false },
    },
  );
}

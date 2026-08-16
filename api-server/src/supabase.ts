import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@nexa/db-types/src/types";
import { env } from "./env.js";

/**
 * Request-scoped client carrying the caller's session. Every query it makes is
 * subject to RLS — this is the client almost all route handlers should use.
 *
 * Direct replacement for apps/customer's old createClient(): that one read the
 * session from a Next.js cookie, this one reads it from the Authorization
 * header the frontend attaches to every call (its own direct Supabase Auth
 * session token) — same RLS guarantee, different transport.
 */
export function createUserClient(accessToken?: string): SupabaseClient<Database> {
  return createClient<Database>(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
    // No token: leave the default anon-key auth alone — an *empty* Bearer
    // header is a malformed auth attempt, not "no auth", and PostgREST
    // rejects it rather than falling back to anonymous. Only override the
    // header when there's an actual token to send.
    ...(accessToken ? { global: { headers: { Authorization: `Bearer ${accessToken}` } } } : {}),
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/**
 * Service-role client. Bypasses RLS entirely.
 *
 * Use only where the platform itself is the actor and no user session can be
 * trusted to authorise the write — same rule as the old createAdminClient().
 * Never use this to satisfy a request just because a route didn't have a
 * token; that silently drops the RLS boundary the DB is relying on.
 */
export function createAdminClient(): SupabaseClient<Database> {
  return createClient<Database>(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

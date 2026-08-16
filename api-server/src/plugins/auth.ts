import fp from "fastify-plugin";
import type { FastifyPluginAsync } from "fastify";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@nexa/db-types/src/types";
import { createUserClient } from "../supabase.js";

declare module "fastify" {
  interface FastifyRequest {
    /**
     * Request-scoped, RLS-respecting Supabase client — built from the caller's
     * Bearer token when present. Every route should read through this, the
     * same way old Server Component code used createClient(). Never null:
     * with no token it's still a valid (anonymous) client, so public,
     * RLS-readable data still works for a signed-out visitor.
     */
    supabase: SupabaseClient<Database>;
    /** The caller's Supabase Auth user, or null if unauthenticated / the token didn't validate. */
    user: { id: string; email: string | null; role: string } | null;
  }
}

/**
 * Reads the caller's Bearer token (their own direct Supabase Auth session —
 * the three frontends sign in straight against Supabase, this server never
 * issues its own tokens), validates it with supabase.auth.getUser(token) —
 * not just decoding it — and builds a per-request RLS-scoped client from the
 * same token, so authorization behaves exactly as it did when this logic
 * lived in Next.js Server Components reading a session cookie.
 */
const authPlugin: FastifyPluginAsync = async (app) => {
  app.decorateRequest("supabase", null as unknown as SupabaseClient<Database>);
  app.decorateRequest("user", null);

  app.addHook("onRequest", async (request) => {
    const header = request.headers.authorization;
    const token = header?.startsWith("Bearer ") ? header.slice(7) : null;

    // No token: still a real (anonymous) client, so RLS-public data works.
    const supabase = createUserClient(token ?? undefined);
    request.supabase = supabase;

    if (!token) {
      request.user = null;
      return;
    }

    // getUser(), not getSession() — revalidates against Supabase rather than
    // trusting whatever the client sent, same reasoning as the old Next.js
    // middleware's updateSession().
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data.user) {
      request.user = null;
      return;
    }

    const role = typeof data.user.app_metadata?.role === "string" ? data.user.app_metadata.role : "customer";
    request.user = { id: data.user.id, email: data.user.email ?? null, role };
  });
};

export default fp(authPlugin);

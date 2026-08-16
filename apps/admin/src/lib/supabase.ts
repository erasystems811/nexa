import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!url || !anonKey) {
  throw new Error("VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY are not set");
}

/**
 * Direct browser Supabase Auth client. Admin is deliberately left bare (no
 * email tag) — it's a single env-provisioned staff login list, not a
 * per-person signup independent of the other two apps.
 */
export const supabase = createClient(url, anonKey);

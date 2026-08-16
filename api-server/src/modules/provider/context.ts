import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@nexa/db-types/src/types";

export class ProviderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProviderError";
  }
}

/**
 * The signed-in provider's own business row, or null. Ported from
 * apps/customer's modules/provider/context.ts — every Studio query starts
 * here; RLS restricts the rest.
 */
export async function currentProvider(supabase: SupabaseClient<Database>) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase.from("providers").select("*").eq("user_id", user.id).maybeSingle();
  return data;
}

/** Throws when there is no provider — for routes that must have one. */
export async function requireProvider(supabase: SupabaseClient<Database>) {
  const provider = await currentProvider(supabase);
  if (!provider) throw new ProviderError("You do not have a provider account");
  return provider;
}

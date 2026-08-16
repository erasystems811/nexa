import "server-only";

import { createClient } from "@/lib/supabase/server";

export class ProviderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProviderError";
  }
}

/**
 * The signed-in provider's own business row, or null if the caller is not an
 * approved provider. Every Studio query starts here; RLS restricts the rest.
 */
export async function currentProvider() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("providers")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  return data;
}

/** Throws when there is no provider — for actions that must have one. */
export async function requireProvider() {
  const provider = await currentProvider();
  if (!provider) throw new ProviderError("You do not have a provider account");
  return provider;
}

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@nexa/db-types/src/types";

/** The vendor's own view of their monthly platform fee. Ported from apps/customer's modules/provider/subscription.ts — unchanged. */
export async function mySubscription(supabase: SupabaseClient<Database>) {
  const { data } = await supabase
    .from("provider_subscriptions")
    .select("status, amount_kobo, current_period_end, last_paid_at")
    .maybeSingle();
  return data;
}

export function isListable(status: string | undefined): boolean {
  return status === "active" || status === "trialing";
}

import "server-only";

import { createClient } from "@/lib/supabase/server";

/**
 * The vendor's own view of their monthly platform fee.
 *
 * A lapsed vendor is hidden from the marketplace by RLS — their listings simply
 * stop coming back in customer queries. Without this, that would be invisible
 * and inexplicable to them: leads dry up and nothing says why. So Business
 * Studio tells them, plainly, and keeps working while they sort it out.
 *
 * RLS lets a vendor read only their own row.
 */
export async function mySubscription() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("provider_subscriptions")
    .select("status, amount_kobo, current_period_end, last_paid_at")
    .maybeSingle();
  return data;
}

/** Is this vendor's listing visible to customers right now? */
export function isListable(status: string | undefined): boolean {
  return status === "active" || status === "trialing";
}

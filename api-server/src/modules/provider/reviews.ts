import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@nexa/db-types/src/types";
import { ProviderError } from "./context.js";

/** Reviews: read and reply. Ported from apps/customer's modules/provider/reviews.ts — unchanged. guard_review_scores rejects any attempt to touch the four rating axes. */

export async function listMyReviews(supabase: SupabaseClient<Database>, providerId: string) {
  const { data } = await supabase
    .from("reviews")
    .select("id, quality, punctuality, communication, value, comment, provider_reply, provider_replied_at, created_at")
    .eq("provider_id", providerId)
    .order("created_at", { ascending: false });
  return data ?? [];
}

export async function replyToReview(
  supabase: SupabaseClient<Database>,
  providerId: string,
  reviewId: string,
  reply: string,
): Promise<void> {
  const text = reply.trim();
  if (!text) throw new ProviderError("A reply cannot be empty");

  const { error } = await supabase
    .from("reviews")
    .update({ provider_reply: text, provider_replied_at: new Date().toISOString() })
    .eq("id", reviewId)
    .eq("provider_id", providerId);

  if (error) throw new ProviderError(error.message);
}

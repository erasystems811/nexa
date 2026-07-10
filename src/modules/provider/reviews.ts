import "server-only";

import { createClient } from "@/lib/supabase/server";
import { ProviderError } from "./context";

/**
 * Reviews. PRD Section 13: read and reply.
 *
 * A provider may reply and nothing else — guard_review_scores (0011) rejects any
 * attempt to touch the four rating axes, so a provider cannot edit the numbers
 * that feed their own reputation.
 */

export async function listMyReviews(providerId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("reviews")
    .select("id, quality, punctuality, communication, value, comment, provider_reply, provider_replied_at, created_at")
    .eq("provider_id", providerId)
    .order("created_at", { ascending: false });
  return data ?? [];
}

export async function replyToReview(
  providerId: string,
  reviewId: string,
  reply: string,
): Promise<void> {
  const text = reply.trim();
  if (!text) throw new ProviderError("A reply cannot be empty");

  const supabase = await createClient();
  const { error } = await supabase
    .from("reviews")
    .update({ provider_reply: text, provider_replied_at: new Date().toISOString() })
    .eq("id", reviewId)
    .eq("provider_id", providerId);

  if (error) throw new ProviderError(error.message);
}

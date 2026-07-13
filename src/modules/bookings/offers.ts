import "server-only";

import { createClient } from "@/lib/supabase/server";
import { BookingsError } from "./service";

/**
 * Price offers for Negotiable listings.
 *
 * The provider quotes inside the conversation; the customer accepts; only then
 * can a booking exist, and only at that number. Enforced by RLS plus
 * `guard_price_offer_write` — a provider cannot accept their own quote.
 */

export async function listOffers(conversationId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("price_offers")
    .select("id, amount_kobo, note, status, created_at, listing_id, customer_id, provider_id")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false });
  return data ?? [];
}

export async function sendOffer(input: {
  conversationId: string;
  listingId: string;
  providerId: string;
  customerId: string;
  amountKobo: number;
  note?: string;
}) {
  if (input.amountKobo <= 0) throw new BookingsError("An offer must be more than zero");

  const supabase = await createClient();
  const { error } = await supabase.from("price_offers").insert({
    conversation_id: input.conversationId,
    listing_id: input.listingId,
    provider_id: input.providerId,
    customer_id: input.customerId,
    amount_kobo: input.amountKobo,
    note: input.note ?? null,
  });

  if (error) throw new BookingsError(`Offer not sent: ${error.message}`);
}

export async function acceptOffer(offerId: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("price_offers")
    .update({ status: "accepted" })
    .eq("id", offerId);

  if (error) throw new BookingsError(`Could not accept the offer: ${error.message}`);
}

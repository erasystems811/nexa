import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@nexa/db-types/src/types";
import { createAdminClient } from "../../supabase.js";
import { notifyWhatsappOfferIfBound } from "../messaging/notify-stub.js";
import { BookingsError } from "./service.js";

/**
 * Price offers for Negotiable listings. Ported from apps/customer's
 * modules/bookings/offers.ts — unchanged. The provider quotes, the customer
 * accepts, only then can a booking exist, and only at that number.
 */

export async function listOffers(supabase: SupabaseClient<Database>, conversationId: string) {
  const { data } = await supabase
    .from("price_offers")
    .select("id, amount_kobo, note, status, created_at, listing_id, customer_id, provider_id")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false });
  return data ?? [];
}

export async function sendOffer(
  supabase: SupabaseClient<Database>,
  input: { conversationId: string; listingId: string; providerId: string; customerId: string; amountKobo: number; note?: string },
) {
  if (input.amountKobo <= 0) throw new BookingsError("An offer must be more than zero");

  const { data, error } = await supabase
    .from("price_offers")
    .insert({
      conversation_id: input.conversationId,
      listing_id: input.listingId,
      provider_id: input.providerId,
      customer_id: input.customerId,
      amount_kobo: input.amountKobo,
      note: input.note ?? null,
    })
    .select("id")
    .single();

  if (error || !data) throw new BookingsError(`Offer not sent: ${error?.message}`);

  try {
    await notifyWhatsappOfferIfBound({
      conversationId: input.conversationId,
      offerId: data.id,
      amountKobo: input.amountKobo,
      listingId: input.listingId,
    });
  } catch {
    // The offer itself is already saved and visible in Business Studio/the web chat.
  }
}

export async function acceptOffer(supabase: SupabaseClient<Database>, offerId: string) {
  const { error } = await supabase.from("price_offers").update({ status: "accepted" }).eq("id", offerId);
  if (error) throw new BookingsError(`Could not accept the offer: ${error.message}`);
}

/** Same transition as acceptOffer, for the WhatsApp "Accept" button path (no session; caller must already have verified ownership). */
export async function acceptOfferAsAdmin(offerId: string) {
  const admin = createAdminClient();
  const { error } = await admin
    .from("price_offers")
    .update({ status: "accepted", accepted_at: new Date().toISOString() })
    .eq("id", offerId);

  if (error) throw new BookingsError(`Could not accept the offer: ${error.message}`);
}

/** Same as sendOffer, for a vendor quoting straight from WhatsApp (no session; caller must already have resolved the sender via the thread binding). */
export async function sendOfferAsAdmin(input: {
  conversationId: string;
  listingId: string;
  providerId: string;
  customerId: string;
  amountKobo: number;
}) {
  if (input.amountKobo <= 0) throw new BookingsError("An offer must be more than zero");

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("price_offers")
    .insert({
      conversation_id: input.conversationId,
      listing_id: input.listingId,
      provider_id: input.providerId,
      customer_id: input.customerId,
      amount_kobo: input.amountKobo,
    })
    .select("id")
    .single();

  if (error || !data) throw new BookingsError(`Offer not sent: ${error?.message}`);

  try {
    await notifyWhatsappOfferIfBound({
      conversationId: input.conversationId,
      offerId: data.id,
      amountKobo: input.amountKobo,
      listingId: input.listingId,
    });
  } catch {
    // The offer itself is already saved and visible in Business Studio.
  }
}

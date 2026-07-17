import "server-only";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { notifyWhatsappOfferIfBound } from "@/modules/messaging/whatsapp";
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

  // Best-effort: a WhatsApp-bound customer has no browser session, so they get
  // a native "Accept" button alongside this quote showing up in the relayed
  // chat text. A failure here must never undo the offer that was just sent.
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

export async function acceptOffer(offerId: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("price_offers")
    .update({ status: "accepted" })
    .eq("id", offerId);

  if (error) throw new BookingsError(`Could not accept the offer: ${error.message}`);
}

/**
 * Same transition as acceptOffer, but for the WhatsApp "Accept" button path,
 * which has no session to satisfy price_offers_update's RLS check. Only ever
 * called from handleOfferButtonReply (src/modules/messaging/whatsapp.ts),
 * after it has already verified by hand that the offer is still pending and
 * that the tapping WhatsApp number belongs to the offer's own customer.
 */
export async function acceptOfferAsAdmin(offerId: string) {
  const admin = createAdminClient();
  const { error } = await admin
    .from("price_offers")
    .update({ status: "accepted", accepted_at: new Date().toISOString() })
    .eq("id", offerId);

  if (error) throw new BookingsError(`Could not accept the offer: ${error.message}`);
}

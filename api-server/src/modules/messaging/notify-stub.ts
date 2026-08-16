/**
 * Placeholder for modules/messaging/whatsapp's notification functions —
 * messaging (including the 1,369-line whatsapp.ts) hasn't been ported to
 * api-server yet. Every caller already wraps these in a best-effort
 * try/catch (a failed notification must never undo a paid booking or a sent
 * offer), so a safe no-op here doesn't change behavior for anything except
 * "the vendor doesn't get pinged on WhatsApp yet" — which is already true
 * until messaging is ported.
 *
 * Replace this file's exports with the real ones from
 * modules/messaging/whatsapp.ts when that module is ported.
 */
export async function notifyVendorOfNewBooking(_bookingId: string): Promise<void> {
  // TODO(messaging port): ping the vendor's WhatsApp thread.
}

export async function notifyWhatsappOfferIfBound(_input: {
  conversationId: string;
  offerId: string;
  amountKobo: number;
  listingId: string;
}): Promise<void> {
  // TODO(messaging port): send the offer as a WhatsApp message if the conversation is WhatsApp-bound.
}

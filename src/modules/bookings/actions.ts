"use server";

import type { Route } from "next";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireSession } from "@/modules/auth";
import { getOrCreateConversation } from "@/modules/messaging";
import { createClient } from "@/lib/supabase/server";
import { acceptOffer, checkout, resumePayment, sendOffer, BookingsError } from ".";

export interface CheckoutState {
  error?: string;
}

/** Fixed-price flow: date/time -> confirm -> pay. */
export async function checkoutAction(
  _prev: CheckoutState,
  formData: FormData,
): Promise<CheckoutState> {
  const { userId, email, profile } = await requireSession();

  const listingId = String(formData.get("listingId") ?? "");
  const date = String(formData.get("date") ?? "");
  const time = String(formData.get("time") ?? "");

  if (!date || !time) return { error: "Choose a date and a time" };

  const scheduledStart = new Date(`${date}T${time}`);
  if (Number.isNaN(scheduledStart.getTime())) return { error: "That date is not valid" };
  if (scheduledStart.getTime() < Date.now()) return { error: "That time is in the past" };

  let bookingId: string;
  let checkoutUrl: string | undefined;
  try {
    const result = await checkout(
      {
        listingId,
        scheduledStart: scheduledStart.toISOString(),
        address: String(formData.get("address") ?? "") || undefined,
        notes: String(formData.get("notes") ?? "") || undefined,
      },
      { id: userId, email: email ?? "", name: profile.full_name ?? undefined },
    );
    bookingId = result.bookingId;
    checkoutUrl = result.checkoutUrl;
  } catch (error) {
    return {
      error: error instanceof BookingsError ? error.message : "Payment could not be completed",
    };
  }

  revalidatePath("/orders");
  // A real gateway hands back a hosted checkout link: the customer types their
  // card on Flutterwave's own page, then Flutterwave returns them to
  // /orders/{id} (the redirect_url set in the payments service). The mock gateway
  // settles inline and returns no link, so it falls through to the order page.
  // Cast: this is an external Flutterwave URL, not one of the app's typed routes.
  if (checkoutUrl) redirect(checkoutUrl as Route);
  redirect(`/orders/${bookingId}`);
}

/**
 * Finish paying for a booking the customer started and abandoned. Same shape as
 * checkoutAction: on success it redirects (to the gateway link, or the order),
 * and the redirect lives outside the try so its control-flow throw is not caught
 * as a payment error.
 */
export async function resumePaymentAction(
  _prev: CheckoutState,
  formData: FormData,
): Promise<CheckoutState> {
  const { userId, email, profile } = await requireSession();
  const bookingId = String(formData.get("bookingId") ?? "");

  let checkoutUrl: string | undefined;
  try {
    const result = await resumePayment(bookingId, {
      id: userId,
      email: email ?? "",
      name: profile.full_name ?? undefined,
    });
    checkoutUrl = result.checkoutUrl;
  } catch (error) {
    return {
      error: error instanceof BookingsError ? error.message : "Payment could not be started",
    };
  }

  revalidatePath("/orders");
  revalidatePath(`/orders/${bookingId}`);
  if (checkoutUrl) redirect(checkoutUrl as Route);
  redirect(`/orders/${bookingId}`);
}

/**
 * Negotiable flow: no booking yet. Open the conversation, and let the two of
 * them agree a number first
 */
export async function discussListingAction(formData: FormData): Promise<void> {
  const { userId } = await requireSession();
  const listingId = String(formData.get("listingId") ?? "");

  const supabase = await createClient();
  const { data: listing } = await supabase
    .from("listings")
    .select("id, provider_id")
    .eq("id", listingId)
    .single();

  if (!listing) throw new BookingsError("That listing is not available");

  const conversationId = await getOrCreateConversation({
    customerId: userId,
    providerId: listing.provider_id,
    listingId: listing.id,
  });

  redirect(`/whatsapp/${conversationId}`);
}

export async function sendOfferAction(formData: FormData): Promise<void> {
  await requireSession();
  const conversationId = String(formData.get("conversationId") ?? "");
  const amountNaira = Number(formData.get("amount") ?? 0);

  const supabase = await createClient();
  const { data: conversation } = await supabase
    .from("conversations")
    .select("id, customer_id, provider_id, listing_id")
    .eq("id", conversationId)
    .single();

  if (!conversation?.listing_id) {
    throw new BookingsError("This conversation is not about a listing");
  }

  await sendOffer({
    conversationId,
    listingId: conversation.listing_id,
    providerId: conversation.provider_id,
    customerId: conversation.customer_id,
    amountKobo: Math.round(amountNaira * 100),
  });

  revalidatePath(`/whatsapp/${conversationId}`);
}

export async function acceptOfferAction(offerId: string, conversationId: string): Promise<void> {
  await requireSession();
  await acceptOffer(offerId);
  revalidatePath(`/whatsapp/${conversationId}`);
}

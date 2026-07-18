"use server";

import { revalidatePath } from "next/cache";
import { verifyOrderAccessToken } from "@/lib/order-access";
import { cancelBookingByCustomer, BookingsError } from "@/modules/bookings";

export interface CancelState {
  error?: string;
  done?: boolean;
}

/**
 * The token is re-checked here, not trusted from the page render - a stale or
 * tampered form post must not be able to cancel a booking that isn't theirs.
 */
export async function cancelOrderAction(
  _prev: CancelState,
  formData: FormData,
): Promise<CancelState> {
  const bookingId = String(formData.get("bookingId") ?? "");
  const token = String(formData.get("token") ?? "");

  if (!verifyOrderAccessToken(bookingId, token)) {
    return { error: "This link is no longer valid." };
  }

  try {
    await cancelBookingByCustomer(bookingId);
  } catch (error) {
    return { error: error instanceof BookingsError ? error.message : "Could not cancel this booking." };
  }

  revalidatePath(`/track/${bookingId}`);
  return { done: true };
}

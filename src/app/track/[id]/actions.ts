"use server";

import { revalidatePath } from "next/cache";
import { verifyOrderAccessToken } from "@/lib/order-access";
import { cancelBookingByCustomer, setPasswordForBookingCustomer, BookingsError } from "@/modules/bookings";

export interface CancelState {
  error?: string;
  done?: boolean;
}

export interface SetPasswordState {
  error?: string;
  done?: boolean;
  /** Their WhatsApp number, echoed back so the confirmation can say exactly
   *  what to type in on the sign-in page - "your number" means nothing once
   *  they've left this page. */
  phone?: string;
}

/**
 * A WhatsApp-only account has no email, so it never had a password to set in
 * the first place - the tracking link itself is the only proof of identity
 * needed here, the same way a password-reset email link works for anyone
 * else. Lets them trade "a link that expires" for "a password that doesn't".
 */
export async function setPasswordAction(
  _prev: SetPasswordState,
  formData: FormData,
): Promise<SetPasswordState> {
  const bookingId = String(formData.get("bookingId") ?? "");
  const token = String(formData.get("token") ?? "");
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  if (!verifyOrderAccessToken(bookingId, token)) {
    return { error: "This link is no longer valid." };
  }

  if (password.length < 8) {
    return { error: "Password must be at least 8 characters" };
  }
  if (password !== confirm) {
    return { error: "Those passwords don't match" };
  }

  try {
    const result = await setPasswordForBookingCustomer(bookingId, password);
    if (!result) return { error: "Could not find this booking" };
    return { done: true, phone: result.phone ?? undefined };
  } catch {
    return { error: "Could not set a password - please try again" };
  }
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

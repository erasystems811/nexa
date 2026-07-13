"use server";

import { revalidatePath } from "next/cache";
import type { Route } from "next";
import { redirect } from "next/navigation";
import { requireRole } from "@/modules/auth";
import {
  requireProvider,
  ProviderError,
  accept,
  blockUnavailable,
  startFulfillment,
  checkIn,
  createListing,
  deleteListing,
  deleteMedia,
  duplicateListing,
  reject,
  removeBlock,
  replyToReview,
  setListingPaused,
  updateBankDetails,
  updateContact,
  updateListing,
  updateProfile,
  uploadMedia,
} from ".";
import type { PaymentType } from "@/lib/db/types";

/**
 * Every action re-checks the role and re-resolves the provider from the session.
 * A Server Action is a POST endpoint; the /studio layout guards the page, but
 * not the endpoint, so the check lives here too.
 */
async function provider() {
  await requireRole("provider");
  return requireProvider();
}

export interface FormState {
  error?: string;
  ok?: boolean;
}

function fail(error: unknown): FormState {
  return { error: error instanceof ProviderError ? error.message : "Something went wrong" };
}

// ---- profile --------------------------------------------------------------

export async function saveProfileAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const p = await provider();
  try {
    await updateProfile(p.id, {
      business_name: String(formData.get("business_name") ?? p.business_name),
      description: String(formData.get("description") ?? ""),
      address: String(formData.get("address") ?? ""),
    });
    await updateContact(p.id, {
      contact_phone: String(formData.get("contact_phone") ?? ""),
      contact_email: String(formData.get("contact_email") ?? ""),
    });
    revalidatePath("/studio/profile");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function saveBankAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const p = await provider();
  try {
    await updateBankDetails(p.id, {
      bank_code: String(formData.get("bank_code") ?? ""),
      bank_account_number: String(formData.get("bank_account_number") ?? ""),
      bank_account_name: String(formData.get("bank_account_name") ?? ""),
    });
    revalidatePath("/studio/wallet");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

// ---- listings -------------------------------------------------------------

function readListingForm(formData: FormData) {
  const priceType = String(formData.get("price_type") ?? "fixed") as "fixed" | "negotiable";
  const toKobo = (name: string) => {
    const v = formData.get(name);
    return v ? Math.round(Number(v) * 100) : null;
  };
  return {
    title: String(formData.get("title") ?? ""),
    categoryId: String(formData.get("category_id") ?? ""),
    description: String(formData.get("description") ?? "") || undefined,
    priceType,
    paymentType: String(formData.get("payment_type") ?? "full") as PaymentType,
    priceKobo: toKobo("price"),
    priceMinKobo: toKobo("price_min"),
    priceMaxKobo: toKobo("price_max"),
    cautionFeeKobo: toKobo("caution_fee") ?? 0,
  };
}

export async function createListingAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const p = await provider();
  let id: string;
  try {
    id = await createListing(p.id, readListingForm(formData));
  } catch (e) {
    return fail(e);
  }
  revalidatePath("/studio/listings");
  redirect(`/listings/${id}` as Route);
}

export async function updateListingAction(
  listingId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const p = await provider();
  try {
    await updateListing(p.id, listingId, readListingForm(formData));
    revalidatePath(`/studio/listings/${listingId}`);
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function pauseListingAction(listingId: string, paused: boolean): Promise<void> {
  const p = await provider();
  await setListingPaused(p.id, listingId, paused);
  revalidatePath("/studio/listings");
  revalidatePath(`/studio/listings/${listingId}`);
}

export async function deleteListingAction(listingId: string): Promise<void> {
  const p = await provider();
  await deleteListing(p.id, listingId);
  revalidatePath("/studio/listings");
  redirect("/listings" as Route);
}

export async function duplicateListingAction(listingId: string): Promise<void> {
  const p = await provider();
  const newId = await duplicateListing(p.id, listingId);
  revalidatePath("/studio/listings");
  redirect(`/listings/${newId}` as Route);
}

// ---- media ----------------------------------------------------------------

export async function uploadMediaAction(
  listingId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const p = await provider();
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "Choose a file" };
  try {
    await uploadMedia(p.id, listingId, file);
    revalidatePath(`/studio/listings/${listingId}`);
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function deleteMediaAction(mediaId: string, listingId: string): Promise<void> {
  const p = await provider();
  await deleteMedia(p.id, mediaId);
  revalidatePath(`/studio/listings/${listingId}`);
}

// ---- availability ---------------------------------------------------------

export async function blockAction(_prev: FormState, formData: FormData): Promise<FormState> {
  await provider();
  const listingId = String(formData.get("listing_id") ?? "");
  const date = String(formData.get("date") ?? "");
  if (!date) return { error: "Pick a date" };
  try {
    await blockUnavailable({
      listingId,
      startsAt: new Date(`${date}T00:00`).toISOString(),
      endsAt: new Date(`${date}T23:59`).toISOString(),
      note: String(formData.get("note") ?? "") || undefined,
    });
    revalidatePath(`/studio/listings/${listingId}/availability`);
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function removeBlockAction(blockId: string, listingId: string): Promise<void> {
  await provider();
  await removeBlock(blockId);
  revalidatePath(`/studio/listings/${listingId}/availability`);
}

// ---- orders ---------------------------------------------------------------

export async function acceptOrderAction(bookingId: string): Promise<void> {
  const p = await provider();
  await accept(p.id, bookingId);
  revalidatePath("/studio/orders");
}

export async function rejectOrderAction(bookingId: string): Promise<void> {
  const p = await provider();
  await reject(p.id, bookingId);
  revalidatePath("/studio/orders");
}

export async function startFulfillmentAction(bookingId: string): Promise<void> {
  const p = await provider();
  await startFulfillment(p.id, bookingId);
  revalidatePath("/studio/orders");
}

export async function checkInAction(bookingId: string): Promise<void> {
  const p = await provider();
  await checkIn(p.id, bookingId);
  revalidatePath("/studio/orders");
}

// ---- reviews --------------------------------------------------------------

export async function replyReviewAction(
  reviewId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const p = await provider();
  try {
    await replyToReview(p.id, reviewId, String(formData.get("reply") ?? ""));
    revalidatePath("/studio/reviews");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

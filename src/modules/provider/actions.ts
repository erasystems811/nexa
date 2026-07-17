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
  startWork,
  enterCompletionCode,
  reportProblem,
  createListing,
  deleteListing,
  deleteMedia,
  duplicateListing,
  reject,
  removeBlock,
  replyToReview,
  setListingPaused,
  submitIdDocument,
  updateBankDetails,
  updateContact,
  updateListing,
  updateProfile,
  uploadProfilePhoto,
  uploadMedia,
  type IdType,
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

/**
 * Logo and cover are their own action: a photo upload should not fail if the
 * text fields have a validation error, and vice versa.
 */
export async function uploadProfilePhotoAction(
  kind: "logo" | "cover",
  file: File,
): Promise<{ url?: string; error?: string }> {
  const p = await provider();
  try {
    const url = await uploadProfilePhoto(p.id, kind, file);
    revalidatePath("/studio/profile");
    revalidatePath(`/p/${p.slug}`);
    return { url };
  } catch (e) {
    return { error: e instanceof ProviderError ? e.message : "Upload failed" };
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

/**
 * payment_type is no longer a choice a vendor makes. There is no deposit — Nexa
 * holds the whole amount — so every listing is written as "full" and the column
 * survives only because the schema is not mine to change.
 */
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
    paymentType: "full" as PaymentType,
    priceKobo: toKobo("price"),
    priceMinKobo: toKobo("price_min"),
    priceMaxKobo: toKobo("price_max"),
  };
}

export async function createListingAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const p = await provider();
  let id: string;
  try {
    id = await createListing(p.id, readListingForm(formData));

    // The photos picked on the create form. They upload against the new listing
    // and land as pending_approval alongside it, so the listing reaches Admin
    // with its pictures instead of arriving empty and gaining them later.
    const photos = formData.getAll("photos").filter((f): f is File => f instanceof File && f.size > 0);
    for (const photo of photos) {
      await uploadMedia(p.id, id, photo);
    }
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

// ---- identification -------------------------------------------------------

/**
 * The vendor sending Nexa one of their two means of ID. They can submit it and
 * see it; they cannot approve it. That is not politeness — provider_documents
 * has no update policy for them at all.
 */
export async function submitIdDocumentAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const p = await provider();
  const file = formData.get("id_file");
  if (!(file instanceof File) || file.size === 0) return { error: "Attach a photo of your ID" };

  try {
    await submitIdDocument(p.id, {
      idType: String(formData.get("id_type") ?? "") as IdType,
      idNumber: String(formData.get("id_number") ?? ""),
      file,
    });
    revalidatePath("/studio/verification");
    revalidatePath("/studio");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
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

/**
 * The vendor tells the customer the job is under way. Moves no money: Nexa is
 * holding the whole amount and pays the vendor on the customer's code.
 */
export async function startWorkAction(bookingId: string): Promise<void> {
  const p = await provider();
  await startWork(p.id, bookingId);
  revalidatePath("/studio/orders");
}

/**
 * The vendor enters the customer's code and is paid. Returns how much was sent so
 * the screen can say so.
 */
export async function enterCodeAction(bookingId: string, code: string): Promise<{ paidKobo: number }> {
  const p = await provider();
  const result = await enterCompletionCode(p.id, bookingId, code);
  revalidatePath("/studio/orders");
  return result;
}

export async function reportProblemAction(bookingId: string, message: string): Promise<void> {
  const p = await provider();
  await reportProblem(p.id, bookingId, message);
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

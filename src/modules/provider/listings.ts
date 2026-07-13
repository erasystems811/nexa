import "server-only";

import { createClient } from "@/lib/supabase/server";
import { ProviderError } from "./context";
import type { PaymentType } from "@/lib/db/types";

/**
 * Listings.(create, edit, delete, pause, duplicate) and
 * (everything starts, and re-enters, Pending Approval).
 *
 * The "starts pending" rule is not enforced here — it is enforced by
 * guard_listing_status_change, which forces a provider insert into an
 * unapproved status and blocks a provider from ever setting 'approved'. This
 * module could forget to set the status and the database would still be right.
 */

export interface ListingInput {
  title: string;
  categoryId: string;
  description?: string;
  priceType: "fixed" | "negotiable";
  paymentType: PaymentType;
  priceKobo?: number | null;
  priceMinKobo?: number | null;
  priceMaxKobo?: number | null;
  cancellationPolicy?: Array<{ min_hours_before: number; refund_percent: number }>;
}

function slugify(title: string): string {
  return (
    title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) +
    "-" +
    Math.random().toString(36).slice(2, 8)
  );
}

export async function listMyListings(providerId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("listings")
    .select("id, title, slug, status, price_type, payment_type, price_kobo, price_min_kobo, price_max_kobo, categories ( name )")
    .eq("provider_id", providerId)
    .order("created_at", { ascending: false });
  return data ?? [];
}

export async function getMyListing(providerId: string, listingId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("listings")
    .select("*")
    .eq("id", listingId)
    .eq("provider_id", providerId)
    .maybeSingle();
  return data;
}

function validate(input: ListingInput): void {
  if (!input.title.trim()) throw new ProviderError("A listing needs a title");
  if (input.priceType === "fixed" && !input.priceKobo) {
    throw new ProviderError("A fixed-price listing needs a price");
  }
  if (
    input.priceMinKobo != null &&
    input.priceMaxKobo != null &&
    input.priceMinKobo > input.priceMaxKobo
  ) {
    throw new ProviderError("The minimum price cannot exceed the maximum");
  }
}

export async function createListing(providerId: string, input: ListingInput): Promise<string> {
  validate(input);
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("listings")
    .insert({
      provider_id: providerId,
      category_id: input.categoryId,
      title: input.title.trim(),
      slug: slugify(input.title),
      description: input.description ?? null,
      price_type: input.priceType,
      payment_type: input.paymentType,
      price_kobo: input.priceType === "fixed" ? (input.priceKobo ?? null) : null,
      price_min_kobo: input.priceMinKobo ?? null,
      price_max_kobo: input.priceMaxKobo ?? null,
      cancellation_policy: input.cancellationPolicy ?? [],
      status: "pending_approval",
    })
    .select("id")
    .single();

  if (error || !data) throw new ProviderError(error?.message ?? "Could not create the listing");
  return data.id;
}

/**
 * Editing price or core details sends the listing back to Pending Approval —
 * but that is listings_reapproval's job, not this function's. We just
 * write the change.
 */
export async function updateListing(
  providerId: string,
  listingId: string,
  input: ListingInput,
): Promise<void> {
  validate(input);
  const supabase = await createClient();

  const { error } = await supabase
    .from("listings")
    .update({
      title: input.title.trim(),
      category_id: input.categoryId,
      description: input.description ?? null,
      price_type: input.priceType,
      payment_type: input.paymentType,
      price_kobo: input.priceType === "fixed" ? (input.priceKobo ?? null) : null,
      price_min_kobo: input.priceMinKobo ?? null,
      price_max_kobo: input.priceMaxKobo ?? null,
    })
    .eq("id", listingId)
    .eq("provider_id", providerId);

  if (error) throw new ProviderError(error.message);
}

/** Pause hides an approved listing without deleting it.. */
export async function setListingPaused(
  providerId: string,
  listingId: string,
  paused: boolean,
): Promise<void> {
  const supabase = await createClient();

  // A paused listing goes to 'paused'; unpausing returns it to Pending Approval,
  // never straight to approved — that decision stays Admin's. The status guard
  // only permits provider moves within {draft, pending_approval, paused}.
  const { error } = await supabase
    .from("listings")
    .update({ status: paused ? "paused" : "pending_approval" })
    .eq("id", listingId)
    .eq("provider_id", providerId);

  if (error) throw new ProviderError(error.message);
}

export async function deleteListing(providerId: string, listingId: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("listings")
    .delete()
    .eq("id", listingId)
    .eq("provider_id", providerId);
  if (error) throw new ProviderError(error.message);
}

/** Duplicate.. The copy is a fresh draft, pending like any new listing. */
export async function duplicateListing(providerId: string, listingId: string): Promise<string> {
  const source = await getMyListing(providerId, listingId);
  if (!source) throw new ProviderError("That listing does not exist");

  return createListing(providerId, {
    title: `${source.title} (copy)`,
    categoryId: source.category_id,
    description: source.description ?? undefined,
    priceType: source.price_type,
    paymentType: source.payment_type,
    priceKobo: source.price_kobo,
    priceMinKobo: source.price_min_kobo,
    priceMaxKobo: source.price_max_kobo,
    cancellationPolicy: Array.isArray(source.cancellation_policy)
      ? (source.cancellation_policy as Array<{ min_hours_before: number; refund_percent: number }>)
      : [],
  });
}

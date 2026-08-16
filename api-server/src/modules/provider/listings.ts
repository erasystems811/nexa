import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, PaymentType } from "@nexa/db-types/src/types";
import { ProviderError } from "./context.js";
import { providerIsVerified, NOT_VERIFIED_MESSAGE } from "./identification.js";

/**
 * Listings CRUD + pause/duplicate. Ported from apps/customer's
 * modules/provider/listings.ts — unchanged. The "starts pending" rule is
 * enforced by the DB trigger guard_listing_status_change, not here.
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

export async function listMyListings(supabase: SupabaseClient<Database>, providerId: string) {
  const { data } = await supabase
    .from("listings")
    .select(
      "id, title, slug, status, price_type, payment_type, price_kobo, price_min_kobo, price_max_kobo, categories ( name )",
    )
    .eq("provider_id", providerId)
    .order("created_at", { ascending: false });
  return data ?? [];
}

export async function getMyListing(supabase: SupabaseClient<Database>, providerId: string, listingId: string) {
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
  if (input.priceMinKobo != null && input.priceMaxKobo != null && input.priceMinKobo > input.priceMaxKobo) {
    throw new ProviderError("The minimum price cannot exceed the maximum");
  }
}

async function requireVerified(supabase: SupabaseClient<Database>, providerId: string): Promise<void> {
  if (!(await providerIsVerified(supabase, providerId))) throw new ProviderError(NOT_VERIFIED_MESSAGE);
}

export async function createListing(
  supabase: SupabaseClient<Database>,
  providerId: string,
  input: ListingInput,
): Promise<string> {
  validate(input);
  await requireVerified(supabase, providerId);

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

export async function updateListing(
  supabase: SupabaseClient<Database>,
  providerId: string,
  listingId: string,
  input: ListingInput,
): Promise<void> {
  validate(input);

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

export async function setListingPaused(
  supabase: SupabaseClient<Database>,
  providerId: string,
  listingId: string,
  paused: boolean,
): Promise<void> {
  if (!paused) await requireVerified(supabase, providerId);

  const { error } = await supabase
    .from("listings")
    .update({ status: paused ? "paused" : "pending_approval" })
    .eq("id", listingId)
    .eq("provider_id", providerId);

  if (error) throw new ProviderError(error.message);
}

export async function deleteListing(supabase: SupabaseClient<Database>, providerId: string, listingId: string): Promise<void> {
  const { error } = await supabase.from("listings").delete().eq("id", listingId).eq("provider_id", providerId);
  if (error) throw new ProviderError(error.message);
}

export async function duplicateListing(supabase: SupabaseClient<Database>, providerId: string, listingId: string): Promise<string> {
  const source = await getMyListing(supabase, providerId, listingId);
  if (!source) throw new ProviderError("That listing does not exist");

  return createListing(supabase, providerId, {
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

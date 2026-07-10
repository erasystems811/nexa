import "server-only";

import { createClient } from "@/lib/supabase/server";

/**
 * Search — discovery over listings and providers. PRD Section 07.
 *
 * Owns no tables. Every query here relies on RLS for its safety: an unapproved
 * listing, or a listing belonging to a suspended provider, is filtered out by
 * `listings_public_read` (0011). Nothing in this file has to remember to check.
 *
 * Section 07: "Only available listings are shown — no messaging ten providers
 * to find one who is free."
 */

export interface ListingFilters {
  q?: string;
  categorySlug?: string;
  citySlug?: string;
  minPriceKobo?: number;
  maxPriceKobo?: number;
  minRating?: number;
  /** ISO timestamp. Excludes listings the provider has marked unavailable. */
  availableAt?: string;
  limit?: number;
}

export interface ListingResult {
  id: string;
  slug: string;
  title: string;
  priceKobo: number | null;
  priceMinKobo: number | null;
  priceMaxKobo: number | null;
  priceType: "fixed" | "negotiable";
  categoryName: string;
  categorySlug: string;
  providerName: string;
  providerSlug: string;
  avgRating: number | null;
  reviewCount: number;
}

export async function searchListings(filters: ListingFilters): Promise<ListingResult[]> {
  const supabase = await createClient();

  let query = supabase
    .from("listings")
    .select(
      `id, slug, title, price_kobo, price_min_kobo, price_max_kobo, price_type,
       categories!inner ( name, slug ),
       providers!inner ( id, business_name, slug, cities ( slug ) )`,
    )
    .eq("status", "approved")
    .limit(filters.limit ?? 40);

  if (filters.q) query = query.ilike("title", `%${filters.q}%`);
  if (filters.categorySlug) query = query.eq("categories.slug", filters.categorySlug);
  if (filters.citySlug) query = query.eq("providers.cities.slug", filters.citySlug);
  if (filters.minPriceKobo !== undefined) query = query.gte("price_kobo", filters.minPriceKobo);
  if (filters.maxPriceKobo !== undefined) query = query.lte("price_kobo", filters.maxPriceKobo);

  const { data } = await query;

  const rows = (data ?? []) as unknown as Array<{
    id: string;
    slug: string;
    title: string;
    price_kobo: number | null;
    price_min_kobo: number | null;
    price_max_kobo: number | null;
    price_type: "fixed" | "negotiable";
    categories: { name: string; slug: string };
    providers: { id: string; business_name: string; slug: string };
  }>;

  if (rows.length === 0) return [];

  // Ratings come from a view rather than an embedded aggregate, so one query
  // covers every listing on the page instead of one per provider.
  const { data: ratings } = await supabase
    .from("provider_ratings")
    .select("provider_id, avg_rating, review_count")
    .in("provider_id", [...new Set(rows.map((r) => r.providers.id))]);

  const byProvider = new Map((ratings ?? []).map((r) => [r.provider_id, r] as const));

  let results: ListingResult[] = rows.map((r) => {
    const rating = byProvider.get(r.providers.id);
    return {
      id: r.id,
      slug: r.slug,
      title: r.title,
      priceKobo: r.price_kobo,
      priceMinKobo: r.price_min_kobo,
      priceMaxKobo: r.price_max_kobo,
      priceType: r.price_type,
      categoryName: r.categories.name,
      categorySlug: r.categories.slug,
      providerName: r.providers.business_name,
      providerSlug: r.providers.slug,
      avgRating: rating?.avg_rating ?? null,
      reviewCount: rating?.review_count ?? 0,
    };
  });

  if (filters.minRating !== undefined) {
    const min = filters.minRating;
    results = results.filter((r) => (r.avgRating ?? 0) >= min);
  }

  // Section 07: only listings the provider is actually free for.
  if (filters.availableAt) {
    const at = filters.availableAt;
    const { data: blocked } = await supabase
      .from("listing_availability")
      .select("listing_id")
      .eq("is_available", false)
      .lte("starts_at", at)
      .gte("ends_at", at);

    const blockedIds = new Set((blocked ?? []).map((b) => b.listing_id));
    results = results.filter((r) => !blockedIds.has(r.id));
  }

  return results;
}

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@nexa/db-types/src/types";
import { listingCovers } from "../marketplace/covers.js";

/**
 * Search — discovery over listings and providers. Ported from apps/customer's
 * modules/search/index.ts — identical logic, functions now take the caller's
 * request-scoped Supabase client instead of an implicit one.
 *
 * Owns no tables. Every query here relies on RLS for its safety.
 */

export interface ListingFilters {
  q?: string;
  categorySlug?: string;
  /**
   * Free text, not a fixed city list — Nigerian event locations are
   * neighborhood-level ("Wuse 2", "Maitama"), finer than the `cities` table.
   * Matches against a provider's address, falling back to their city name.
   */
  location?: string;
  minPriceKobo?: number;
  maxPriceKobo?: number;
  minRating?: number;
  availableAt?: string;
  limit?: number;
  offset?: number;
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
  coverUrl: string | null;
  avgRating: number | null;
  reviewCount: number;
}

export interface VendorResult {
  id: string;
  slug: string;
  businessName: string;
  logoUrl: string | null;
  coverUrl: string | null;
  cityName: string | null;
  avgRating: number | null;
  reviewCount: number;
  /** How many services this vendor offers in the current view. */
  serviceCount: number;
}

/**
 * Free-text location resolves to a set of provider ids up front — it has to
 * match a specific area in providers.address, not just the city join, and
 * PostgREST can't OR across two different embedded-table levels in a single
 * filter. Two plain queries merged in JS, not a spliced .or() string.
 *
 * Returns null when no location filter is active, [] when it matched nothing.
 */
async function resolveLocationProviderIds(
  supabase: SupabaseClient<Database>,
  location: string | undefined,
): Promise<string[] | null> {
  if (!location) return null;

  const term = `%${location}%`;
  const [{ data: matchingCities }, { data: byAddress }] = await Promise.all([
    supabase.from("cities").select("id").ilike("name", term),
    supabase.from("providers").select("id").ilike("address", term),
  ]);
  const cityIds = (matchingCities ?? []).map((c) => c.id);
  const idSet = new Set((byAddress ?? []).map((p) => p.id));
  if (cityIds.length > 0) {
    const { data: byCity } = await supabase.from("providers").select("id").in("city_id", cityIds);
    for (const p of byCity ?? []) idSet.add(p.id);
  }
  return [...idSet];
}

/**
 * Browse: one card per vendor, not one per service. Built from approved
 * listings on purpose — a vendor appears here only if they have at least one
 * live service.
 */
export async function searchVendors(
  supabase: SupabaseClient<Database>,
  filters: { categorySlug?: string; location?: string; limit?: number },
): Promise<VendorResult[]> {
  const locationProviderIds = await resolveLocationProviderIds(supabase, filters.location);
  if (locationProviderIds && locationProviderIds.length === 0) return [];

  const ROW_SAFETY_CAP = 600;

  let query = supabase
    .from("listings")
    .select(
      `id, provider_id, created_at,
       categories!inner ( slug ),
       providers!inner ( id, business_name, slug, logo_url, cover_url, is_featured, cities ( name, slug ) )`,
    )
    .eq("status", "approved")
    .order("created_at", { ascending: false })
    .limit(ROW_SAFETY_CAP);

  if (filters.categorySlug) query = query.eq("categories.slug", filters.categorySlug);
  if (locationProviderIds) query = query.in("provider_id", locationProviderIds);

  const { data } = await query;

  const rows = (data ?? []) as unknown as Array<{
    id: string;
    providers: {
      id: string;
      business_name: string;
      slug: string;
      logo_url: string | null;
      cover_url: string | null;
      is_featured: boolean;
      cities: { name: string } | null;
    };
  }>;

  if (rows.length === 0) return [];

  const byVendor = new Map<string, VendorResult & { isFeatured: boolean; listingId: string }>();
  for (const r of rows) {
    const p = r.providers;
    const existing = byVendor.get(p.id);
    if (existing) {
      existing.serviceCount += 1;
      continue;
    }
    byVendor.set(p.id, {
      id: p.id,
      slug: p.slug,
      businessName: p.business_name,
      logoUrl: p.logo_url,
      coverUrl: p.cover_url,
      cityName: p.cities?.name ?? null,
      avgRating: null,
      reviewCount: 0,
      serviceCount: 1,
      isFeatured: p.is_featured,
      listingId: r.id,
    });
  }

  const vendors = [...byVendor.values()];

  const { data: ratings } = await supabase
    .from("provider_ratings")
    .select("provider_id, avg_rating, review_count")
    .in("provider_id", vendors.map((v) => v.id));

  const byId = new Map((ratings ?? []).map((r) => [r.provider_id, r] as const));
  for (const v of vendors) {
    const rating = byId.get(v.id);
    v.avgRating = rating?.avg_rating ?? null;
    v.reviewCount = rating?.review_count ?? 0;
  }

  vendors.sort((a, b) => {
    if (a.isFeatured !== b.isFeatured) return a.isFeatured ? -1 : 1;
    if ((b.avgRating ?? 0) !== (a.avgRating ?? 0)) return (b.avgRating ?? 0) - (a.avgRating ?? 0);
    return b.serviceCount - a.serviceCount;
  });

  const limited = filters.limit ? vendors.slice(0, filters.limit) : vendors;
  return limited.map(({ isFeatured: _isFeatured, listingId: _listingId, ...v }) => v);
}

/** Search: a typed query for a specific item, across every vendor that offers one. */
export async function searchListings(
  supabase: SupabaseClient<Database>,
  filters: ListingFilters,
): Promise<ListingResult[]> {
  const locationProviderIds = await resolveLocationProviderIds(supabase, filters.location);
  if (locationProviderIds && locationProviderIds.length === 0) return [];

  let query = supabase
    .from("listings")
    .select(
      `id, slug, title, price_kobo, price_min_kobo, price_max_kobo, price_type,
       categories!inner ( name, slug ),
       providers!inner ( id, business_name, slug, logo_url, cover_url )`,
    )
    .eq("status", "approved")
    .range(filters.offset ?? 0, (filters.offset ?? 0) + (filters.limit ?? 40) - 1);

  if (filters.q) query = query.textSearch("search_vector", filters.q, { type: "websearch" });
  if (filters.categorySlug) query = query.eq("categories.slug", filters.categorySlug);
  if (locationProviderIds) query = query.in("provider_id", locationProviderIds);
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
    providers: { id: string; business_name: string; slug: string; logo_url: string | null; cover_url: string | null };
  }>;

  if (rows.length === 0) return [];

  const { data: ratings } = await supabase
    .from("provider_ratings")
    .select("provider_id, avg_rating, review_count")
    .in("provider_id", [...new Set(rows.map((r) => r.providers.id))]);

  const byProvider = new Map((ratings ?? []).map((r) => [r.provider_id, r] as const));

  const covers = await listingCovers(rows.map((r) => r.id));

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
      coverUrl: covers.get(r.id) ?? r.providers.cover_url,
      avgRating: rating?.avg_rating ?? null,
      reviewCount: rating?.review_count ?? 0,
    };
  });

  if (filters.minRating !== undefined) {
    const min = filters.minRating;
    results = results.filter((r) => (r.avgRating ?? 0) >= min);
  }

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

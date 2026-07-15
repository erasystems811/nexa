import "server-only";

import { createClient } from "@/lib/supabase/server";
import { listingCovers } from "@/modules/marketplace/covers";

/**
 * Search — discovery over listings and providers.
 *
 * Owns no tables. Every query here relies on RLS for its safety: an unapproved
 * listing, or a listing belonging to a suspended provider, is filtered out by
 * `listings_public_read`. Nothing in this file has to remember to check.
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
 * The marketplace, as a customer browses it: one card per vendor, not one per
 * service. A vendor is a business with a menu — Chowdeck's restaurants — so the
 * browse page shows the business, and opening it (/p/slug) shows the menu.
 *
 * Built from approved listings on purpose: a vendor appears here only if they
 * have at least one live service, so no card ever opens onto an empty menu. When
 * a category is given, the vendor is included for having a service in it, and the
 * count is their services in that category.
 *
 * Search — a typed query for a specific item — stays on searchListings, because
 * that is the other half of the model: browse by business, search by service.
 */
export async function searchVendors(filters: {
  categorySlug?: string;
  citySlug?: string;
  limit?: number;
}): Promise<VendorResult[]> {
  const supabase = await createClient();

  let query = supabase
    .from("listings")
    .select(
      `id, provider_id,
       categories!inner ( slug ),
       providers!inner ( id, business_name, slug, logo_url, cover_url, is_featured, cities ( name, slug ) )`,
    )
    .eq("status", "approved");

  if (filters.categorySlug) query = query.eq("categories.slug", filters.categorySlug);
  if (filters.citySlug) query = query.eq("providers.cities.slug", filters.citySlug);

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

  // One entry per vendor, counting how many of their services this view covers,
  // and remembering one listing per vendor to borrow a photo from.
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

  // A vendor with no cover of their own borrows their first service's photo —
  // the picture they actually uploaded, which is what a customer expects to see.
  const needCover = vendors.filter((v) => !v.coverUrl);
  if (needCover.length > 0) {
    const covers = await listingCovers(needCover.map((v) => v.listingId));
    for (const v of needCover) {
      v.coverUrl = covers.get(v.listingId) ?? null;
    }
  }

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

  // Featured first, then the better-reviewed, then the more prolific.
  vendors.sort((a, b) => {
    if (a.isFeatured !== b.isFeatured) return a.isFeatured ? -1 : 1;
    if ((b.avgRating ?? 0) !== (a.avgRating ?? 0)) return (b.avgRating ?? 0) - (a.avgRating ?? 0);
    return b.serviceCount - a.serviceCount;
  });

  const limited = filters.limit ? vendors.slice(0, filters.limit) : vendors;
  return limited.map(({ isFeatured: _isFeatured, listingId: _listingId, ...v }) => v);
}

export async function searchListings(filters: ListingFilters): Promise<ListingResult[]> {
  const supabase = await createClient();

  let query = supabase
    .from("listings")
    .select(
      `id, slug, title, price_kobo, price_min_kobo, price_max_kobo, price_type,
       categories!inner ( name, slug ),
       providers!inner ( id, business_name, slug, logo_url, cover_url, cities ( slug ) )`,
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
    providers: { id: string; business_name: string; slug: string; logo_url: string | null; cover_url: string | null };
  }>;

  if (rows.length === 0) return [];

  // Ratings come from a view rather than an embedded aggregate, so one query
  // covers every listing on the page instead of one per provider.
  const { data: ratings } = await supabase
    .from("provider_ratings")
    .select("provider_id, avg_rating, review_count")
    .in("provider_id", [...new Set(rows.map((r) => r.providers.id))]);

  const byProvider = new Map((ratings ?? []).map((r) => [r.provider_id, r] as const));

  // A search result's picture is the listing's own uploaded photo — the same
  // photo the browse cards and the listing page show — not the provider banner,
  // which no vendor fills in.
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

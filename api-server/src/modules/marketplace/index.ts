import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@nexa/db-types/src/types";
import { listingCovers } from "./covers.js";

export { categoryImages, categoryImageUrl, BUCKET as CATEGORY_BUCKET } from "./category-images.js";

/**
 * Marketplace — the customer read model. Ported from apps/customer's
 * modules/marketplace/index.ts — identical logic, functions now take the
 * caller's request-scoped Supabase client instead of an implicit one.
 *
 * Every listing here is an event SERVICE, and every vendor fulfils their own.
 * A vendor whose subscription has lapsed is hidden from all of this by
 * `listings_public_read` (RLS) — deliberately not a filter in these queries.
 */

export async function listCategories(supabase: SupabaseClient<Database>) {
  const { data } = await supabase
    .from("categories")
    .select("id, name, slug, icon, fulfillment_type")
    .eq("is_active", true)
    .order("sort_order");
  return data ?? [];
}

export async function listCities(supabase: SupabaseClient<Database>) {
  const { data } = await supabase
    .from("cities")
    .select("id, name, slug")
    .eq("is_active", true)
    .order("name");
  return data ?? [];
}

/** The newest listings, for the homepage. RLS makes "newest approved" exactly what a customer may see. */
export async function recentListings(supabase: SupabaseClient<Database>, limit = 8) {
  const { data } = await supabase
    .from("listings")
    .select(
      `id, slug, title, price_kobo, price_min_kobo, price_max_kobo, price_type,
       categories ( name, slug ),
       providers!inner ( business_name, slug, logo_url, cover_url, cities ( name ) )`,
    )
    .eq("status", "approved")
    .order("created_at", { ascending: false })
    .limit(limit);

  return data ?? [];
}

export async function featuredProviders(supabase: SupabaseClient<Database>, limit = 6) {
  const { data: providers } = await supabase
    .from("providers")
    .select("id, business_name, slug, logo_url, cover_url, is_featured, description, cities ( name )")
    .eq("status", "approved")
    .limit(limit);

  if (!providers?.length) return [];

  const { data: ratings } = await supabase
    .from("provider_ratings")
    .select("provider_id, avg_rating, review_count")
    .in("provider_id", providers.map((p) => p.id));

  const byProvider = new Map((ratings ?? []).map((r) => [r.provider_id, r] as const));

  return providers
    .map((p) => ({
      ...p,
      avgRating: byProvider.get(p.id)?.avg_rating ?? null,
      reviewCount: byProvider.get(p.id)?.review_count ?? 0,
    }))
    .sort((a, b) => {
      if (a.is_featured !== b.is_featured) return a.is_featured ? -1 : 1;
      return (b.avgRating ?? 0) - (a.avgRating ?? 0);
    });
}

export async function getProviderBySlug(supabase: SupabaseClient<Database>, slug: string) {
  const { data: provider } = await supabase
    .from("providers")
    .select("id, business_name, slug, description, logo_url, cover_url, is_featured, cities ( name )")
    .eq("slug", slug)
    .eq("status", "approved")
    .maybeSingle();

  if (!provider) return null;

  const [{ data: listings }, { data: rating }, { data: reviews }] = await Promise.all([
    supabase
      .from("listings")
      .select("id, slug, title, price_kobo, price_min_kobo, price_max_kobo, price_type, categories ( name, slug, vendor_tier )")
      .eq("provider_id", provider.id)
      .eq("status", "approved"),
    supabase
      .from("provider_ratings")
      .select("avg_rating, review_count")
      .eq("provider_id", provider.id)
      .maybeSingle(),
    supabase
      .from("reviews")
      .select("id, quality, punctuality, communication, value, comment, created_at")
      .eq("provider_id", provider.id)
      .order("created_at", { ascending: false })
      .limit(10),
  ]);

  const rows = listings ?? [];
  const covers = await listingCovers(rows.map((l) => l.id));
  const withCovers = rows.map((l) => ({ ...l, coverUrl: covers.get(l.id) ?? null }));

  return { provider, listings: withCovers, rating: rating ?? null, reviews: reviews ?? [] };
}

export async function getListingBySlug(supabase: SupabaseClient<Database>, slug: string) {
  const { data } = await supabase
    .from("listings")
    .select(
      `id, slug, title, description, price_kobo, price_min_kobo, price_max_kobo,
       price_type, payment_type, cancellation_policy,
       categories ( id, name, slug, fulfillment_type, vendor_tier ),
       providers ( id, business_name, slug, logo_url, cover_url )`,
    )
    .eq("slug", slug)
    .eq("status", "approved")
    .maybeSingle();

  if (!data) return null;

  const covers = await listingCovers([data.id]);
  return { ...data, coverUrl: covers.get(data.id) ?? null };
}

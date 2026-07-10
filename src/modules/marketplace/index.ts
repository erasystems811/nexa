import "server-only";

import { createClient } from "@/lib/supabase/server";

/**
 * Marketplace — the customer read model. PRD Sections 07, 14.
 *
 * Plan My Event is a curation layer over Bookings, not a second engine, and
 * stays behind the `plan_my_event` flag until Phase 2 of the roadmap. Nothing
 * in this file references it.
 */

export async function listCategories() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("categories")
    .select("id, name, slug, icon, fulfillment_type")
    .eq("is_active", true)
    .order("sort_order");
  return data ?? [];
}

export async function listCities() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("cities")
    .select("id, name, slug")
    .eq("is_active", true)
    .order("name");
  return data ?? [];
}

/**
 * Section 14: "featured and top-rated providers".
 *
 * Featured is an Admin switch. Top-rated is computed from structured reviews —
 * never from the reliability score, which stays hidden until Admin turns on
 * `public_reliability_score` (Section 18).
 */
export async function featuredProviders(limit = 6) {
  const supabase = await createClient();

  const { data: providers } = await supabase
    .from("providers")
    .select("id, business_name, slug, logo_url, is_featured")
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

export async function getProviderBySlug(slug: string) {
  const supabase = await createClient();

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
      .select("id, slug, title, price_kobo, price_min_kobo, price_max_kobo, price_type, categories ( name, slug )")
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

  return { provider, listings: listings ?? [], rating: rating ?? null, reviews: reviews ?? [] };
}

export async function getListingBySlug(slug: string) {
  const supabase = await createClient();

  const { data } = await supabase
    .from("listings")
    .select(
      `id, slug, title, description, price_kobo, price_min_kobo, price_max_kobo,
       price_type, payment_type, caution_fee_kobo, cancellation_policy,
       categories ( id, name, slug, fulfillment_type ),
       providers ( id, business_name, slug, logo_url )`,
    )
    .eq("slug", slug)
    .eq("status", "approved")
    .maybeSingle();

  return data;
}

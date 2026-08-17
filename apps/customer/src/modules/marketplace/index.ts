import "server-only";

import { unstable_cache } from "next/cache";
import { createPublicClient } from "@/lib/supabase/public";

/**
 * Marketplace — the customer read model.
 *
 * Every listing here is an event SERVICE, and every vendor fulfils their own.
 *
 * A vendor whose subscription has lapsed is hidden from all of this by
 * `listings_public_read`, which calls provider_is_listable. That is
 * deliberately not a filter in these queries: RLS covers search, category pages,
 * the vendor profile and a direct link at once, and cannot be forgotten.
 *
 * Plan My Event is a curation layer over Bookings, not a second engine, and
 * stays behind the `plan_my_event` flag until Phase 2 of the roadmap. Nothing
 * in this file references it.
 *
 * Every read below goes through `createPublicClient` (anon key, no cookies)
 * and is wrapped in `unstable_cache` — the RLS policies backing these tables
 * grant `to anon, authenticated` with no `auth.uid()` check, so one visitor's
 * result is every visitor's result, and it's safe to reuse across requests
 * for a short window instead of hitting Supabase fresh every time. A 60s
 * revalidate window means a newly-approved listing or a lapsed subscription
 * shows up within a minute — there's no cache-invalidation webhook from
 * Admin/Business Studio (separate apps now) wired up yet, so this is
 * time-based rather than event-based freshness.
 *
 * Each fetcher is declared as a plain named function first and only wrapped
 * in unstable_cache afterward — passing the async function straight into
 * unstable_cache's generic makes TypeScript infer its return type against
 * the constraint's `Promise<any>` instead of the function's real return
 * shape, which collapses multi-branch return types (e.g. `T | null`) down
 * to `{}`. Declaring it separately keeps its natural, bottom-up-inferred type.
 */

export { categoryImages, categoryImageUrl, BUCKET as CATEGORY_BUCKET } from "./category-images";

async function fetchCategories() {
  const supabase = createPublicClient();
  const { data } = await supabase
    .from("categories")
    .select("id, name, slug, icon, fulfillment_type")
    .eq("is_active", true)
    .order("sort_order");
  return data ?? [];
}
export const listCategories = unstable_cache<typeof fetchCategories>(fetchCategories, ["marketplace-categories"], {
  revalidate: 300,
  tags: ["categories"],
});

async function fetchCities() {
  const supabase = createPublicClient();
  const { data } = await supabase.from("cities").select("id, name, slug").eq("is_active", true).order("name");
  return data ?? [];
}
export const listCities = unstable_cache<typeof fetchCities>(fetchCities, ["marketplace-cities"], {
  revalidate: 300,
  tags: ["cities"],
});

/**
 * The newest listings, for the homepage.
 *
 * A customer who lands on Nexa should see real, bookable things — not just a row
 * of category tiles and a search box. Without this, a vendor's brand-new listing
 * was invisible until someone happened to search for it, which is no way to run a
 * marketplace: the whole point is that supply is discoverable the moment it goes
 * live.
 *
 * RLS is what makes this safe to leave unfiltered: `listings_public_read` already
 * hides anything not approved, and anything belonging to a suspended or unpaid
 * vendor. So "newest approved listings" is exactly what a customer is allowed to
 * see, and nothing more.
 */
async function fetchRecentListings(limit = 8) {
  const supabase = createPublicClient();

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
export const recentListings = unstable_cache<typeof fetchRecentListings>(fetchRecentListings, ["marketplace-recent-listings"], {
  revalidate: 60,
  tags: ["listings"],
});

/**
 * Section 14: "featured and top-rated providers".
 *
 * Featured is an Admin switch. Top-rated is computed from structured reviews —
 * never from the reliability score, which stays hidden until Admin turns on
 * `public_reliability_score`.
 */
async function fetchFeaturedProviders(limit = 6) {
  const supabase = createPublicClient();

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
export const featuredProviders = unstable_cache<typeof fetchFeaturedProviders>(fetchFeaturedProviders, ["marketplace-featured-providers"], {
  revalidate: 60,
  tags: ["providers"],
});

// getProviderBySlug / getListingBySlug deliberately do NOT live here anymore.
// apps/l/[slug] and apps/p/[slug] now import them from @nexa/api-client
// instead — api-server's /marketplace/providers/:slug and
// /marketplace/listings/:slug are the live source, with no cache staleness
// window to reason about. Keeping a second, time-cached implementation of
// the same two reads in this file would be exactly the drift risk flagged
// elsewhere in this repo (api-server's ported modules vs. apps/customer's
// originals) — don't re-add them here.

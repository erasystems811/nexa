import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

/**
 * The photo a vendor actually uploaded, made visible to customers.
 *
 * Listing photos live in the private provider-media bucket — the same bucket as
 * a vendor's ID documents — so a customer's browser cannot read them directly.
 * That is why the marketplace was showing a separate `cover_url` that nobody
 * ever filled in, and the real photos went nowhere.
 *
 * The fix is not to make the bucket public (a vendor's NIN is in there). It is
 * to sign the URL here, on the server, with the service role, and hand the
 * customer a link that already works. Only *approved* listing images are signed,
 * and an approved listing image is a thing meant to be seen — that is the whole
 * point of uploading it.
 */

const BUCKET = "provider-media";
// A week, not an hour. The customer pages re-sign on every render, so a fresh
// load always has a fresh link — but if a page or its RSC is cached anywhere,
// a one-hour link would go stale and the photo would break. A week outlives any
// cache, and these are public-facing marketing photos, so a long-lived link
// costs nothing.
const TTL_SECONDS = 60 * 60 * 24 * 7;

/**
 * listingId -> a signed URL of its first approved image. Listings with no
 * approved photo are simply absent from the map.
 */
export async function listingCovers(listingIds: string[]): Promise<Map<string, string>> {
  const ids = [...new Set(listingIds)].filter(Boolean);
  if (ids.length === 0) return new Map();

  const db = createAdminClient();

  const { data: media } = await db
    .from("listing_media")
    .select("listing_id, storage_path, sort_order")
    .in("listing_id", ids)
    .eq("status", "approved")
    .eq("kind", "image")
    .order("sort_order");

  // The first photo of each listing is its cover.
  const pathByListing = new Map<string, string>();
  for (const m of media ?? []) {
    if (!pathByListing.has(m.listing_id)) pathByListing.set(m.listing_id, m.storage_path);
  }

  const paths = [...pathByListing.values()];
  if (paths.length === 0) return new Map();

  const { data: signed } = await db.storage.from(BUCKET).createSignedUrls(paths, TTL_SECONDS);
  const urlByPath = new Map(
    (signed ?? []).filter((s) => s.signedUrl).map((s) => [s.path, s.signedUrl] as const),
  );

  const out = new Map<string, string>();
  for (const [listingId, path] of pathByListing) {
    const url = urlByPath.get(path);
    if (url) out.set(listingId, url);
  }
  return out;
}

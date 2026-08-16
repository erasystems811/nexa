import { createAdminClient } from "../../supabase.js";

/**
 * The photo a vendor actually uploaded, made visible to customers. Ported
 * from apps/customer's modules/marketplace/covers.ts — identical logic.
 *
 * Listing photos live in the private provider-media bucket — the same bucket
 * as a vendor's ID documents — so a customer's browser cannot read them
 * directly. Signed here, on the server, with the service role. Only
 * *approved* listing images are signed.
 */

const BUCKET = "provider-media";
// A week, not an hour — these are public-facing marketing photos re-fetched
// on every render, so a long-lived link costs nothing and outlives any cache.
const TTL_SECONDS = 60 * 60 * 24 * 7;

/** listingId -> a signed URL of its first approved image. */
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

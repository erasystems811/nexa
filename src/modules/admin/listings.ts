import "server-only";

import { adminDb, audit, AdminError } from "./context";

/** Listing approval queue. PRD Section 06, 12. */

export async function listingQueue() {
  const db = adminDb();
  const { data } = await db
    .from("listings")
    .select("id, title, status, price_type, price_kobo, created_at, providers ( business_name ), categories ( name )")
    .in("status", ["pending_approval"])
    .order("created_at", { ascending: true });
  return data ?? [];
}

export async function listAllListings(status?: string) {
  const db = adminDb();
  let q = db
    .from("listings")
    .select("id, title, status, price_type, price_kobo, providers ( business_name )")
    .order("created_at", { ascending: false });
  if (status) q = q.eq("status", status as never);
  const { data } = await q;
  return data ?? [];
}

export async function getListingForReview(listingId: string) {
  const db = adminDb();
  const [listing, media] = await Promise.all([
    db.from("listings").select("*, providers ( business_name ), categories ( name, fulfillment_type )").eq("id", listingId).maybeSingle(),
    db.from("listing_media").select("id, kind, storage_path, status").eq("listing_id", listingId),
  ]);
  if (!listing.data) return null;
  return { listing: listing.data, media: media.data ?? [] };
}

type ListingDecision = "approved" | "rejected" | "changes_requested" | "hidden";

export async function decideListing(
  actorId: string,
  listingId: string,
  decision: ListingDecision,
  reason?: string,
): Promise<void> {
  const db = adminDb();
  const { error } = await db
    .from("listings")
    .update({
      status: decision,
      rejection_reason: decision === "approved" ? null : (reason ?? null),
      approved_at: decision === "approved" ? new Date().toISOString() : null,
      approved_by: decision === "approved" ? actorId : null,
    })
    .eq("id", listingId);
  if (error) throw new AdminError(error.message);

  // Approving a listing approves its pending media alongside it.
  if (decision === "approved") {
    await db.from("listing_media").update({ status: "approved", reviewed_by: actorId, reviewed_at: new Date().toISOString() }).eq("listing_id", listingId).eq("status", "pending_approval");
  }
  await audit(actorId, `listing_${decision}`, "listing", listingId, null, { reason });
}

/** Restore a hidden or rejected listing back into the queue. */
export async function restoreListing(actorId: string, listingId: string): Promise<void> {
  const db = adminDb();
  const { error } = await db.from("listings").update({ status: "pending_approval" }).eq("id", listingId);
  if (error) throw new AdminError(error.message);
  await audit(actorId, "listing_restored", "listing", listingId);
}

export async function decideMedia(actorId: string, mediaId: string, approved: boolean): Promise<void> {
  const db = adminDb();
  const { error } = await db
    .from("listing_media")
    .update({ status: approved ? "approved" : "rejected", reviewed_by: actorId, reviewed_at: new Date().toISOString() })
    .eq("id", mediaId);
  if (error) throw new AdminError(error.message);
  await audit(actorId, approved ? "media_approved" : "media_rejected", "listing_media", mediaId);
}

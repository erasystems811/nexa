import "server-only";

import { adminDb, audit, AdminError } from "./context";
import { isIdentityVerified, REQUIRED_ID_COUNT } from "@/modules/provider";

/** Listing approval queue. */

/**
 * Nothing from an unidentified vendor reaches a customer.
 *
 * Business Studio already refuses to let an unverified vendor create or un-pause
 * a service, but that is Studio's rule. This is the marketplace's: a listing
 * only goes live when Nexa knows who is behind it, however the listing got here
 * — a vendor Admin added by hand, a vendor whose documents were rejected after
 * they listed, a row restored out of the queue.
 */
async function requireVerifiedProvider(listingId: string): Promise<void> {
  const db = adminDb();

  const { data: listing } = await db
    .from("listings")
    .select("provider_id, providers ( business_name )")
    .eq("id", listingId)
    .maybeSingle();

  if (!listing) throw new AdminError("That listing does not exist");

  const { data: documents } = await db
    .from("provider_documents")
    .select("kind, status")
    .eq("provider_id", listing.provider_id);

  if (!isIdentityVerified(documents ?? [])) {
    const name = (listing.providers as unknown as { business_name: string } | null)?.business_name;
    throw new AdminError(
      `${name ?? "This vendor"} is not verified yet. Approve ${REQUIRED_ID_COUNT} means of identification on their vendor page first — then this listing can go live.`,
    );
  }
}

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
  if (decision === "approved") await requireVerifiedProvider(listingId);

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

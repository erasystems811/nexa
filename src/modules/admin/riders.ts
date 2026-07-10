import "server-only";

import { adminDb, audit, AdminError } from "./context";

/** Rider management. PRD Sections 12, 15. */

export async function listRiders(status?: string) {
  const db = adminDb();
  let q = db
    .from("riders")
    .select("id, full_name, phone, vehicle_type, vehicle_plate, status, created_at, cities ( name )")
    .order("created_at", { ascending: false });
  if (status) q = q.eq("status", status as never);
  const { data } = await q;
  return data ?? [];
}

export async function getRiderDetail(riderId: string) {
  const db = adminDb();
  const [rider, reliability, wallet, documents, assignments] = await Promise.all([
    db.from("riders").select("*, cities ( name )").eq("id", riderId).maybeSingle(),
    db.from("rider_reliability").select("*").eq("rider_id", riderId).maybeSingle(),
    db.from("rider_wallets").select("*").eq("rider_id", riderId).maybeSingle(),
    db.from("rider_documents").select("*").eq("rider_id", riderId),
    db
      .from("rider_assignments")
      .select("id, leg, status, fee_share_kobo, delivered_at, bookings ( reference, scheduled_start )")
      .eq("rider_id", riderId)
      .order("assigned_at", { ascending: false })
      .limit(30),
  ]);

  if (!rider.data) return null;
  return {
    rider: rider.data,
    reliability: reliability.data,
    wallet: wallet.data,
    documents: documents.data ?? [],
    assignments: assignments.data ?? [],
  };
}

export async function verifyRider(actorId: string, riderId: string, approved: boolean, reason?: string): Promise<void> {
  const db = adminDb();
  const { error } = await db
    .from("riders")
    .update({
      status: approved ? "approved" : "rejected",
      approved_at: approved ? new Date().toISOString() : null,
      approved_by: approved ? actorId : null,
      rejection_reason: approved ? null : (reason ?? null),
    })
    .eq("id", riderId);
  if (error) throw new AdminError(error.message);

  if (approved) {
    await db.from("rider_documents").update({ status: "approved", reviewed_by: actorId, reviewed_at: new Date().toISOString() }).eq("rider_id", riderId);
  }
  await audit(actorId, approved ? "verify_rider" : "reject_rider", "rider", riderId);
}

export async function setRiderSuspended(actorId: string, riderId: string, suspended: boolean): Promise<void> {
  const db = adminDb();
  const { error } = await db
    .from("riders")
    .update({ status: suspended ? "suspended" : "approved" })
    .eq("id", riderId);
  if (error) throw new AdminError(error.message);
  await audit(actorId, suspended ? "suspend_rider" : "reinstate_rider", "rider", riderId);
}

/**
 * Manually reassign a delivery to another rider (Section 12). Cancels the
 * current assignment and creates a fresh one for the new rider, same leg and
 * fee. The guard trigger permits an admin to write rider/fee; a rider cannot.
 */
export async function reassignDelivery(actorId: string, assignmentId: string, newRiderId: string): Promise<void> {
  const db = adminDb();

  const { data: current } = await db
    .from("rider_assignments")
    .select("id, booking_id, leg, fee_share_kobo, status")
    .eq("id", assignmentId)
    .single();
  if (!current) throw new AdminError("No such assignment");
  if (["delivered", "returned"].includes(current.status)) {
    throw new AdminError("That leg is already complete");
  }

  await db.from("rider_assignments").update({ status: "cancelled" }).eq("id", assignmentId);

  const { error } = await db.from("rider_assignments").insert({
    booking_id: current.booking_id,
    rider_id: newRiderId,
    leg: current.leg,
    status: "assigned",
    fee_share_kobo: current.fee_share_kobo,
    assigned_by: actorId,
  });
  if (error) throw new AdminError(error.message);

  await audit(actorId, "reassign_delivery", "rider_assignment", assignmentId, { rider: current.id }, { newRiderId });
}

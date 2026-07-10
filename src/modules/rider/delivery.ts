import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { confirmWithCode, recordStage1 } from "@/modules/bookings";
import { payRider, settleCaution } from "@/modules/payments";
import { RiderError } from "./context";
import type { RiderAssignmentStatus, VehicleType } from "@/lib/db/types";

/**
 * The delivery and return flows. PRD Section 15, and the payment stages of
 * Section 10.
 *
 * Every function runs on the service role, because completing a stage releases
 * money and reads a bank account no end-user may see — so each one first
 * confirms the assignment belongs to this rider. The status guard
 * (guard_rider_assignment_write, 0011) already stops a rider setting
 * 'delivered'/'returned' from their own client; these functions are the only
 * path to those states, and they get there only by verifying the customer's code.
 *
 * How a rider action maps to a payment stage (Section 10):
 *
 *   Delivery (one code):
 *     pickup from provider         -> provider stage-1 (no code; the pickup is
 *                                     the checkpoint)
 *     drop-off code                -> provider stage-2 + rider FULL fee, complete
 *
 *   Delivery + Return (two codes):
 *     drop-off code #1 (leg 1)     -> provider stage-1 + rider HALF fee
 *     return code #2 (leg 2)       -> provider stage-2 + rider HALF fee,
 *                                     caution settled, complete
 */

async function load(riderId: string, assignmentId: string) {
  const db = createAdminClient();
  const { data } = await db
    .from("rider_assignments")
    .select(
      "id, rider_id, leg, status, fee_share_kobo, condition_notes, bookings ( id, fulfillment_type, scheduled_start, customer_id, delivery_fee_kobo )",
    )
    .eq("id", assignmentId)
    .maybeSingle();

  if (!data || data.rider_id !== riderId) throw new RiderError("That delivery is not assigned to you");
  const booking = data.bookings as unknown as {
    id: string;
    fulfillment_type: "delivery" | "delivery_return" | "onsite_service" | "vendor_location_service";
    scheduled_start: string;
    customer_id: string;
    delivery_fee_kobo: number;
  };
  return { assignment: data, booking, db };
}

async function setStatus(assignmentId: string, status: RiderAssignmentStatus, extra: Record<string, unknown> = {}) {
  const db = createAdminClient();
  const { error } = await db
    .from("rider_assignments")
    .update({ status, ...extra })
    .eq("id", assignmentId);
  if (error) throw new RiderError(error.message);
}

const ACTIVE: RiderAssignmentStatus[] = [
  "assigned",
  "accepted",
  "picked_up",
  "en_route",
  "arrived",
  "delivered",
];

const VEHICLE_LABEL: Record<VehicleType, string> = { bike: "bike", car: "car", van: "van" };

/**
 * The provider calls a rider of a chosen vehicle class. PRD model amended by the
 * founder (0023): the provider presses "Call a bike / car / van" and books a
 * registered rider of that class, rather than Nexa auto-assigning. The rider
 * pool is still Nexa-verified — the provider picks the vehicle, not a stranger.
 *
 * Runs on the service role because it reads across providers and riders and
 * marks the booking ready; `providerId` comes from the caller's own session
 * (requireProvider), so it cannot be spoofed. The booking must belong to that
 * provider, be physical goods, and be accepted.
 */
export async function callRider(
  providerId: string,
  bookingId: string,
  vehicleType: VehicleType,
): Promise<void> {
  const db = createAdminClient();

  const { data: booking } = await db
    .from("bookings")
    .select("id, provider_id, fulfillment_type, status, delivery_fee_kobo, ready_for_pickup_at")
    .eq("id", bookingId)
    .maybeSingle();

  if (!booking || booking.provider_id !== providerId) throw new RiderError("That booking is not yours");
  if (!["delivery", "delivery_return"].includes(booking.fulfillment_type)) {
    throw new RiderError("Only physical-goods deliveries need a rider");
  }
  if (!["accepted", "in_progress"].includes(booking.status)) {
    throw new RiderError("Accept the booking before calling a rider");
  }

  // Already has a rider on the outbound leg? Don't double-book it.
  const { data: existing } = await db
    .from("rider_assignments")
    .select("status")
    .eq("booking_id", bookingId)
    .eq("leg", 1);

  if ((existing ?? []).some((a) => ACTIVE.includes(a.status))) {
    throw new RiderError("A rider is already on this delivery");
  }

  // Skip anyone who already declined this booking.
  const declined = (existing ?? []).length
    ? (
        await db
          .from("rider_assignments")
          .select("rider_id")
          .eq("booking_id", bookingId)
          .eq("leg", 1)
          .eq("status", "declined")
      ).data ?? []
    : [];

  const { data: chosen } = await db.rpc("pick_rider_by_vehicle", {
    p_provider_id: providerId,
    p_vehicle: vehicleType,
    p_exclude: declined.map((d) => d.rider_id),
  });

  if (!chosen) {
    throw new RiderError(`No ${VEHICLE_LABEL[vehicleType]} is available right now. Try another vehicle.`);
  }

  // Calling a rider also marks the item ready (the two are one action now).
  if (!booking.ready_for_pickup_at) {
    await db.from("bookings").update({ ready_for_pickup_at: new Date().toISOString() }).eq("id", bookingId);
  }

  const { data: fee } = await db.rpc("rider_leg_fee", {
    p_delivery_fee: booking.delivery_fee_kobo,
    p_fulfillment: booking.fulfillment_type,
    p_leg: 1,
  });

  const { error } = await db.from("rider_assignments").insert({
    booking_id: bookingId,
    rider_id: chosen as unknown as string,
    leg: 1,
    status: "assigned",
    fee_share_kobo: (fee as unknown as number) ?? 0,
  });

  if (error) throw new RiderError(`Could not call a rider: ${error.message}`);
}

export async function acceptAssignment(riderId: string, assignmentId: string): Promise<void> {
  const { assignment } = await load(riderId, assignmentId);
  if (assignment.status !== "assigned") throw new RiderError("This delivery cannot be accepted now");
  await setStatus(assignmentId, "accepted", { accepted_at: new Date().toISOString() });
}

/** Declining frees the booking for Admin to reassign (Section 12). */
export async function declineAssignment(riderId: string, assignmentId: string): Promise<void> {
  const { assignment } = await load(riderId, assignmentId);
  if (!["assigned", "accepted"].includes(assignment.status)) {
    throw new RiderError("This delivery cannot be declined now");
  }
  await setStatus(assignmentId, "declined");
}

/**
 * Picked up. For a plain Delivery this is the stage-1 checkpoint — the rider
 * collecting from the provider is the verifiable event that releases the
 * provider's partial payout. For Delivery + Return there is no payout here; the
 * drop-off code is stage 1.
 *
 * On the return leg the pickup is from the customer, and the rider records the
 * item's visible condition, which decides the caution outcome later.
 */
export async function markPickedUp(
  riderId: string,
  assignmentId: string,
  conditionNotes?: string,
): Promise<void> {
  const { assignment, booking } = await load(riderId, assignmentId);
  if (assignment.status !== "accepted") throw new RiderError("Accept the delivery first");

  await setStatus(assignmentId, "picked_up", {
    picked_up_at: new Date().toISOString(),
    ...(conditionNotes ? { condition_notes: conditionNotes } : {}),
  });

  // Plain Delivery, outbound: pickup from the provider IS stage 1.
  if (booking.fulfillment_type === "delivery" && assignment.leg === 1) {
    await recordStage1(booking.id);
  }
}

export async function markEnRoute(riderId: string, assignmentId: string): Promise<void> {
  const { assignment } = await load(riderId, assignmentId);
  if (assignment.status !== "picked_up") throw new RiderError("Mark it picked up first");
  await setStatus(assignmentId, "en_route");
}

export async function markArrived(riderId: string, assignmentId: string): Promise<void> {
  const { assignment } = await load(riderId, assignmentId);
  if (assignment.status !== "en_route") throw new RiderError("Mark it en route first");
  await setStatus(assignmentId, "arrived");
}

/**
 * The customer's code, entered at the door. This is the only thing that
 * completes a delivery (Section 15) — a rider cannot mark it done without it.
 */
export async function confirmDelivery(
  riderId: string,
  assignmentId: string,
  code: string,
): Promise<void> {
  const { assignment, booking, db } = await load(riderId, assignmentId);
  if (!["arrived", "en_route", "picked_up"].includes(assignment.status)) {
    throw new RiderError("This delivery is not ready to complete");
  }

  const bank = await riderBank(riderId);

  if (booking.fulfillment_type === "delivery") {
    // The drop-off code is stage 2, and completes the booking.
    await confirmWithCode(booking.id, code);
    await payRider({ bookingId: booking.id, riderId, amountKobo: assignment.fee_share_kobo, stage: 2, ...bank });
  } else {
    // Delivery + Return, leg 1: the drop-off code is stage 1.
    await recordStage1(booking.id, { code });
    await payRider({ bookingId: booking.id, riderId, amountKobo: assignment.fee_share_kobo, stage: 1, ...bank });
  }

  await setStatus(assignmentId, "delivered", { delivered_at: new Date().toISOString() });
  await bumpReliability(riderId, onTime(booking.scheduled_start));

  // Delivery + Return: now schedule the return pickup as its own rider job.
  if (booking.fulfillment_type === "delivery_return") {
    await createReturnLeg(db, booking.id, booking.delivery_fee_kobo, assignment.fee_share_kobo, riderId);
  }
}

/**
 * The return code, entered when the rider collects the rental after the event.
 * PRD Section 15: this triggers stage 2 to provider and rider, and starts the
 * caution fee refund/claim. The item's condition was recorded at pickup.
 */
export async function confirmReturn(
  riderId: string,
  assignmentId: string,
  code: string,
  damaged: boolean,
): Promise<void> {
  const { assignment, booking } = await load(riderId, assignmentId);
  if (assignment.leg !== 2) throw new RiderError("This is not a return job");
  if (!["arrived", "en_route", "picked_up"].includes(assignment.status)) {
    throw new RiderError("Mark the item picked up first");
  }

  const bank = await riderBank(riderId);

  // The return code is stage 2, and completes the booking.
  await confirmWithCode(booking.id, code);
  await payRider({ bookingId: booking.id, riderId, amountKobo: assignment.fee_share_kobo, stage: 2, ...bank });

  // Good condition refunds the caution; damage raises a dispute for Admin.
  await settleCaution({
    bookingId: booking.id,
    damaged,
    notes: assignment.condition_notes ?? undefined,
  });

  await setStatus(assignmentId, "returned", { delivered_at: new Date().toISOString() });
  await bumpReliability(riderId, true);
}

// ---------------------------------------------------------------------------

async function riderBank(riderId: string) {
  const db = createAdminClient();
  const { data } = await db
    .from("rider_wallets")
    .select("bank_code, bank_account_number")
    .eq("rider_id", riderId)
    .single();
  if (!data?.bank_code || !data.bank_account_number) {
    throw new RiderError("Add your payout account before completing a delivery");
  }
  return { bankCode: data.bank_code, accountNumber: data.bank_account_number };
}

function onTime(scheduledStart: string): boolean {
  // A two-hour grace before the event's start counts as on time.
  return Date.now() <= new Date(scheduledStart).getTime() + 2 * 60 * 60 * 1000;
}

async function bumpReliability(riderId: string, wasOnTime: boolean): Promise<void> {
  const db = createAdminClient();
  const { data: r } = await db
    .from("rider_reliability")
    .select("on_time_rate, completed_deliveries")
    .eq("rider_id", riderId)
    .single();

  const prevCompleted = r?.completed_deliveries ?? 0;
  const prevOnTime = Math.round(((r?.on_time_rate ?? 0) / 100) * prevCompleted);
  const completed = prevCompleted + 1;
  const onTimeCount = prevOnTime + (wasOnTime ? 1 : 0);

  await db
    .from("rider_reliability")
    .update({
      completed_deliveries: completed,
      on_time_rate: Math.round((onTimeCount / completed) * 10000) / 100,
      computed_at: new Date().toISOString(),
    })
    .eq("rider_id", riderId);
}

/**
 * Section 15: "After the event, Nexa assigns a return pickup — this is a Nexa
 * rider job." Unlike the outbound leg the provider does not call this one; it is
 * scheduled automatically after drop-off, to a registered rider of the same
 * vehicle class the outbound used (a van load needs a van back). If none is
 * free, Admin assigns it manually.
 */
async function createReturnLeg(
  db: ReturnType<typeof createAdminClient>,
  bookingId: string,
  deliveryFeeKobo: number,
  outboundFeeKobo: number,
  outboundRiderId: string,
): Promise<void> {
  const { data: booking } = await db
    .from("bookings")
    .select("provider_id")
    .eq("id", bookingId)
    .single();
  if (!booking) return;

  const { data: outboundRider } = await db
    .from("riders")
    .select("vehicle_type")
    .eq("id", outboundRiderId)
    .single();
  if (!outboundRider) return;

  const { data: chosen } = await db.rpc("pick_rider_by_vehicle", {
    p_provider_id: booking.provider_id,
    p_vehicle: outboundRider.vehicle_type,
    p_exclude: [],
  });
  if (!chosen) return; // Admin assigns the return manually.

  await db
    .from("rider_assignments")
    .insert({
      booking_id: bookingId,
      rider_id: chosen as unknown as string,
      leg: 2,
      status: "assigned",
      fee_share_kobo: deliveryFeeKobo - outboundFeeKobo,
    })
    .then(() => {});
}

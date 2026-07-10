import "server-only";

import { adminDb, audit, AdminError } from "./context";
import type { BookingStatus } from "@/lib/db/types";

/** Order monitoring. PRD Section 12: every booking, with a manual override. */

export async function listOrders(status?: string) {
  const db = adminDb();
  let q = db
    .from("bookings")
    .select(
      "id, reference, status, fulfillment_type, scheduled_start, agreed_price_kobo, created_at, listings ( title ), providers ( business_name )",
    )
    .order("created_at", { ascending: false })
    .limit(100);
  if (status) q = q.eq("status", status as never);
  const { data } = await q;
  return data ?? [];
}

export async function getOrderDetail(bookingId: string) {
  const db = adminDb();
  const [booking, payment, codes, assignments, ledger] = await Promise.all([
    db.from("bookings").select("*, listings ( title ), providers ( business_name ), profiles!bookings_customer_id_fkey ( full_name )").eq("id", bookingId).maybeSingle(),
    db.from("payments").select("*").eq("booking_id", bookingId).maybeSingle(),
    db.from("booking_confirmation_codes").select("stage, code, consumed_at").eq("booking_id", bookingId).order("stage"),
    db.from("rider_assignments").select("id, leg, status, rider_id, fee_share_kobo, condition_notes").eq("booking_id", bookingId),
    db.from("payment_ledger_entries").select("kind, amount_kobo, stage, note, created_at").eq("booking_id", bookingId).order("created_at"),
  ]);
  if (!booking.data) return null;
  return {
    booking: booking.data,
    payment: payment.data,
    codes: codes.data ?? [],
    assignments: assignments.data ?? [],
    ledger: ledger.data ?? [],
  };
}

/**
 * Manual status override (Section 12). A blunt instrument, used sparingly and
 * always audited — it does not move money, only the booking's state, so an
 * override that skips a checkpoint leaves the payment where it was on purpose.
 */
export async function overrideStatus(actorId: string, bookingId: string, status: BookingStatus, reason: string): Promise<void> {
  const db = adminDb();
  const { data: before } = await db.from("bookings").select("status").eq("id", bookingId).single();
  const { error } = await db.from("bookings").update({ status }).eq("id", bookingId);
  if (error) throw new AdminError(error.message);
  await audit(actorId, "override_booking_status", "booking", bookingId, before, { status, reason });
}

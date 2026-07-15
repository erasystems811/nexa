import "server-only";

import { adminDb, audit, AdminError } from "./context";
import { bookingMoney } from "./payments";
import type { BookingStatus } from "@/lib/db/types";

/** Booking monitoring: every booking, its money, and a manual status override. */

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
  const { data: commissionRow } = await db.from("platform_settings").select("value").eq("key", "commission_percent").maybeSingle();
  const commission = Math.min(100, Math.max(0, Number(commissionRow?.value ?? 0)));
  const [booking, payment, codes, ledger] = await Promise.all([
    db.from("bookings").select("*, listings ( title ), providers ( business_name ), profiles!bookings_customer_id_fkey ( full_name )").eq("id", bookingId).maybeSingle(),
    db.from("payments").select("*").eq("booking_id", bookingId).maybeSingle(),
    db.from("booking_confirmation_codes").select("stage, code, consumed_at").eq("booking_id", bookingId).order("stage"),
    db.from("payment_ledger_entries").select("kind, amount_kobo, note, created_at").eq("booking_id", bookingId).order("created_at"),
  ]);
  if (!booking.data) return null;
  return {
    booking: booking.data,
    payment: payment.data,
    /** What the customer paid, what has gone out, and what Nexa still holds. */
    money: bookingMoney(payment.data, commission),
    commissionPercent: commission,
    codes: codes.data ?? [],
    ledger: ledger.data ?? [],
  };
}

/**
 * Manual status override. A blunt instrument, used sparingly and
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

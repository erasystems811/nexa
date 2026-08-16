import "server-only";

import { adminDb, audit, AdminError } from "./context";
import { releaseFunds, refund } from "@/modules/payments";
import { formatKobo } from "@/lib/money";

/**
 * The money, as an admin sees it.
 *
 * THE MODEL, in one line: the customer pays, Nexa holds the WHOLE amount, and
 * when the job is done an admin decides how much of it goes to the vendor. Nexa
 * keeps whatever is never released. Nothing here computes a percentage of
 * anything, because nothing is owed by formula.
 *
 * "Still held" on a booking is therefore always the same subtraction:
 *
 *     what the customer paid  −  paid to the vendor  −  refunded to the customer
 *
 * and that number is the ceiling on every release and every refund.
 */

/** Booking statuses that mean the job is over: nothing more will be paid out. */
const FINISHED = ["completed", "cancelled", "rejected", "refunded"];


/** Nexa's cut, from the setting. Clamped, because a bad value must never pay a vendor negative money. */
async function commissionPercent(db: ReturnType<typeof adminDb>): Promise<number> {
  const { data } = await db.from("platform_settings").select("value").eq("key", "commission_percent").maybeSingle();
  return Math.min(100, Math.max(0, Number(data?.value ?? 0)));
}

function stillHeld(p: { held_kobo: number; released_kobo: number; refunded_kobo: number }): number {
  return Math.max(0, p.held_kobo - p.released_kobo - p.refunded_kobo);
}

export interface MoneyOverview {
  /** Taken from customers, not paid out or refunded, job not finished yet. */
  holdingKobo: number;
  /** How many bookings that held money is spread across. */
  holdingCount: number;
  /** Sent to vendors' bank accounts, all time. */
  paidToVendorsKobo: number;
  /** Sent back to customers, all time. */
  refundedKobo: number;
  /** Left over on finished jobs — what Nexa has kept. */
  keptKobo: number;
}

export async function moneyOverview(): Promise<MoneyOverview> {
  const db = adminDb();

  const { data } = await db
    .from("payments")
    .select("held_kobo, released_kobo, refunded_kobo, bookings ( status )");

  let holdingKobo = 0;
  let holdingCount = 0;
  let paidToVendorsKobo = 0;
  let refundedKobo = 0;
  let keptKobo = 0;

  for (const p of data ?? []) {
    const status = (p.bookings as unknown as { status: string } | null)?.status ?? "";
    const left = stillHeld(p);
    paidToVendorsKobo += p.released_kobo;
    refundedKobo += p.refunded_kobo;

    if (FINISHED.includes(status)) {
      keptKobo += left;
    } else if (left > 0) {
      holdingKobo += left;
      holdingCount += 1;
    }
  }

  return { holdingKobo, holdingCount, paidToVendorsKobo, refundedKobo, keptKobo };
}

/**
 * The admin's real job queue: jobs that are done, where Nexa is still sitting on
 * the customer's money. Every row is a vendor waiting to be paid.
 */
export async function vendorsWaitingToBePaid() {
  const db = adminDb();

  const { data } = await db
    .from("payments")
    .select(
      "booking_id, held_kobo, released_kobo, refunded_kobo, bookings ( reference, status, providers ( business_name ) )",
    )
    .in("status", ["held", "partially_released"]);

  return (data ?? [])
    .map((p) => {
      const booking = p.bookings as unknown as
        | { reference: string; status: string; providers: { business_name: string } | null }
        | null;
      return {
        bookingId: p.booking_id,
        reference: booking?.reference ?? "—",
        status: booking?.status ?? "",
        vendor: booking?.providers?.business_name ?? "—",
        stillHeldKobo: stillHeld(p),
      };
    })
    .filter((r) => r.status === "completed" && r.stillHeldKobo > 0);
}

/** The last movements of money, newest first. */
export async function recentMoneyMoves(limit = 40) {
  const db = adminDb();
  const { data } = await db
    .from("payment_ledger_entries")
    .select("id, kind, amount_kobo, note, created_at, booking_id")
    .order("created_at", { ascending: false })
    .limit(limit);
  return data ?? [];
}

export interface BookingMoney {
  /** What the customer paid into Nexa. */
  customerPaidKobo: number;
  /** How much of it has gone to the vendor so far. */
  paidToVendorKobo: number;
  /** How much of it has gone back to the customer. */
  refundedKobo: number;
  /** What Nexa is still holding — the most that can be REFUNDED to the customer. */
  stillHeldKobo: number;
  /** The vendor's total pay on this booking: what the customer paid, less commission. */
  vendorPayKobo: number;
  /** Nexa's commission. Always Nexa's — a release to the vendor can never touch it. */
  nexaCommissionKobo: number;
  /** The most that can still be PAID TO THE VENDOR now: their pay, less what they've had. */
  stillOwedVendorKobo: number;
  /** False while the customer has only been sent a payment link. */
  isPaid: boolean;
}

/** Pure: the four numbers of a booking's money, from its payment row. */
export function bookingMoney(
  payment: { amount_kobo: number; held_kobo: number; released_kobo: number; refunded_kobo: number } | null,
  commissionPercentValue = 0,
): BookingMoney | null {
  if (!payment) return null;
  const paid = payment.held_kobo > 0 ? payment.held_kobo : payment.amount_kobo;
  const vendorPayKobo = Math.round(paid * (1 - commissionPercentValue / 100));
  return {
    customerPaidKobo: paid,
    paidToVendorKobo: payment.released_kobo,
    refundedKobo: payment.refunded_kobo,
    stillHeldKobo: stillHeld(payment),
    vendorPayKobo,
    nexaCommissionKobo: paid - vendorPayKobo,
    // A release to the vendor comes out of THEIR pay, never Nexa's commission.
    stillOwedVendorKobo: Math.max(0, vendorPayKobo - payment.released_kobo),
    isPaid: payment.held_kobo > 0,
  };
}

// ---------------------------------------------------------------------------
// The two things an admin does with money. Both are capped by what is held.
// ---------------------------------------------------------------------------

/**
 * Pay the vendor. The admin chooses the amount at the time — all of what is
 * held, or part of it — and may come back and pay more later. Whatever is never
 * released is simply what Nexa keeps.
 */
export async function releaseToVendor(
  actorId: string,
  bookingId: string,
  amountKobo: number,
): Promise<void> {
  const db = adminDb();

  if (!Number.isFinite(amountKobo) || amountKobo <= 0) {
    throw new AdminError("Enter how much to pay the vendor.");
  }

  const { data: booking } = await db
    .from("bookings")
    .select("id, provider_id")
    .eq("id", bookingId)
    .maybeSingle();
  if (!booking) throw new AdminError("No such booking.");

  const { data: payment } = await db
    .from("payments")
    .select("held_kobo, released_kobo, refunded_kobo")
    .eq("booking_id", bookingId)
    .maybeSingle();
  if (!payment || payment.held_kobo <= 0) {
    throw new AdminError("Nexa is not holding any money for this booking.");
  }

  // The vendor is paid out of THEIR pay — the customer's payment less Nexa's
  // commission. The commission is Nexa's and a release can never reach into it,
  // so the ceiling is the vendor's pay, not the whole held amount.
  const commission = await commissionPercent(db);
  const vendorPay = Math.round(payment.held_kobo * (1 - commission / 100));
  const owedToVendor = Math.max(0, vendorPay - payment.released_kobo);
  if (amountKobo > owedToVendor) {
    throw new AdminError(
      `The vendor's pay on this booking is ${formatKobo(vendorPay)} (after Nexa's ${commission}% commission). ` +
        `${payment.released_kobo > 0 ? `You have already released ${formatKobo(payment.released_kobo)}, so ` : ""}` +
        `the most you can pay now is ${formatKobo(owedToVendor)}.`,
    );
  }

  const { data: wallet } = await db
    .from("provider_wallets")
    .select("bank_code, bank_account_number")
    .eq("provider_id", booking.provider_id)
    .maybeSingle();
  if (!wallet?.bank_code || !wallet.bank_account_number) {
    throw new AdminError("This vendor has no bank account saved, so there is nowhere to send the money.");
  }

  await releaseFunds({
    bookingId,
    amountKobo,
    beneficiary: {
      kind: "provider",
      id: booking.provider_id,
      bankCode: wallet.bank_code,
      accountNumber: wallet.bank_account_number,
    },
  });

  await audit(
    actorId,
    "pay_vendor",
    "booking",
    bookingId,
    { owedToVendorKobo: owedToVendor },
    { paidToVendorKobo: amountKobo, owedAfterKobo: owedToVendor - amountKobo },
  );
}

/** Send money back to the customer. Never more than is still held. */
export async function adminRefund(
  actorId: string,
  bookingId: string,
  amountKobo: number,
  reason: string,
): Promise<void> {
  const db = adminDb();

  if (!Number.isFinite(amountKobo) || amountKobo <= 0) {
    throw new AdminError("Enter how much to refund.");
  }

  const { data: payment } = await db
    .from("payments")
    .select("held_kobo, released_kobo, refunded_kobo")
    .eq("booking_id", bookingId)
    .maybeSingle();
  if (!payment || payment.held_kobo <= 0) {
    throw new AdminError("Nexa is not holding any money for this booking.");
  }

  const held = stillHeld(payment);
  if (amountKobo > held) {
    throw new AdminError(
      `Nexa is only holding ${formatKobo(held)} on this booking, so that is the most you can refund.`,
    );
  }

  await refund({ bookingId, amountKobo, reason });
  await audit(
    actorId,
    "refund",
    "booking",
    bookingId,
    { stillHeldKobo: held },
    { refundedKobo: amountKobo, reason },
  );
}

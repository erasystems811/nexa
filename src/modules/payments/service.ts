import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { getPaymentGateway } from "./gateway";
import { calculateLatePenalty } from "./calculations";
import type { Kobo } from "@/lib/money";

/**
 * The Payments module's public face.
 *
 * Booking logic calls holdFunds / releaseFunds / refund and nothing else. It
 * never sees a gateway, a checkout URL, or a Flutterwave reference. If a future
 * phase swaps the processor, every caller of this file keeps compiling.
 *
 * THE MONEY MODEL (services-only, migration 0028)
 * ---------------------------------------------------------------------------
 * Nexa IS the escrow. The customer pays 100% of the agreed price up front, into
 * Nexa's own balance. It leaves again in exactly two movements:
 *
 *   stage 1  the vendor ACCEPTS  ->  the deposit share (the booking's frozen
 *            stage_1_release_percent) goes to their bank account, so they can
 *            buy materials before the job.
 *   stage 2  the customer hands over their ONE confirmation code at the end ->
 *            the balance, less Nexa's commission, goes to the vendor and the
 *            booking completes.
 *
 * There is no third thing. No delivery fee, no caution fee —
 * a service is not rented out and does not come back damaged.
 *
 * The write path runs on the service-role client on purpose: RLS grants nobody
 * INSERT on payment_ledger_entries, the ledger's append-only trigger refuses
 * UPDATE and DELETE from every role including this one, and
 * `guard_wallet_balance_write` rejects a wallet-balance write from
 * anyone but this module. Money is recorded once, by this file, or not at all.
 */

export class PaymentsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PaymentsError";
  }
}

export interface HoldFundsInput {
  bookingId: string;
  reference: string;
  /** The whole agreed price. There is no other charge on a service booking. */
  amountKobo: Kobo;
  /** Nexa's cut, computed from the percentage frozen onto the booking. */
  commissionKobo?: Kobo;
  customer: { id: string; email: string; name?: string };
  redirectUrl: string;
}

export interface HoldFundsOutput {
  paymentId: string;
  checkoutUrl?: string;
}

/**
 * Takes the customer's money into escrow. Nothing reaches the provider here —
 * that is the entire premise of the platform
 *
 * The provider's gross (price less commission) lands in their wallet as
 * *pending*: earned, sitting in Nexa's balance, not theirs yet. releaseFunds is
 * what turns pending into money in their bank account.
 */
export async function holdFunds(input: HoldFundsInput): Promise<HoldFundsOutput> {
  const gateway = getPaymentGateway();
  const db = createAdminClient();

  const commissionKobo = input.commissionKobo ?? 0;

  const result = await gateway.holdFunds({
    reference: input.reference,
    amountKobo: input.amountKobo,
    customer: {
      id: input.customer.id,
      email: input.customer.email,
      name: input.customer.name,
    },
    redirectUrl: input.redirectUrl,
    metadata: { booking_id: input.bookingId },
  });

  const { data, error } = await db
    .from("payments")
    .insert({
      booking_id: input.bookingId,
      amount_kobo: input.amountKobo,
      commission_kobo: commissionKobo,
      status: result.status === "held" ? "held" : "pending",
      held_kobo: result.status === "held" ? input.amountKobo : 0,
      gateway: gateway.name,
      gateway_reference: result.gatewayReference,
    })
    .select("id")
    .single();

  if (error || !data) {
    throw new PaymentsError(`Could not record the hold: ${error?.message}`);
  }

  // The hold itself is a ledger event. Every kobo that moves gets a row, and
  // the customer's escrow balance is derived from these, never from a column
  // somebody remembered to update.
  await db.from("payment_ledger_entries").insert({
    payment_id: data.id,
    booking_id: input.bookingId,
    kind: "hold",
    amount_kobo: input.amountKobo,
    customer_id: input.customer.id,
    note: "Escrow hold",
  });

  // What the vendor has earned but cannot touch. Nothing credited this before —
  // every wallet in the system read zero pending, forever.
  const providerId = await providerIdFor(db, input.bookingId);
  await adjustWallet(db, providerId, { pendingKobo: input.amountKobo - commissionKobo });

  return { paymentId: data.id, checkoutUrl: result.checkoutUrl };
}

export interface ReleaseFundsInput {
  bookingId: string;
  /** 1 = the deposit, on acceptance. 2 = the balance, on the customer's code. */
  stage: 1 | 2;
  amountKobo: Kobo;
  beneficiary: {
    kind: "provider";
    id: string;
    bankCode: string;
    accountNumber: string;
  };
}

/**
 * Releases one stage's share to a provider's bank account.
 *
 * The caller is responsible for having verified the checkpoint — the vendor's
 * acceptance at stage 1, and at stage 2 a confirmation code entered by the
 * customer, never a provider tapping "done" This function
 * does not know what a confirmation code is, and should not.
 *
 * `idempotencyKey` is derived, not random: the same (booking, stage,
 * beneficiary) can be submitted twice by a retried webhook and pay once.
 */
export async function releaseFunds(input: ReleaseFundsInput): Promise<void> {
  const gateway = getPaymentGateway();
  const db = createAdminClient();

  const { data: payment, error: loadError } = await db
    .from("payments")
    .select("id, gateway_reference, held_kobo, released_kobo, commission_kobo, stage_1_released_at, stage_2_released_at")
    .eq("booking_id", input.bookingId)
    .single();

  if (loadError || !payment) {
    throw new PaymentsError(`No payment found for booking ${input.bookingId}`);
  }

  const row = payment;
  if (!row.gateway_reference) {
    throw new PaymentsError(`Booking ${input.bookingId} has no gateway reference to release against`);
  }

  // A stage releases once. The gateway is idempotent on our key, but the ledger
  // is not, and two rows would double-count what the provider is owed.
  const alreadyReleased =
    input.stage === 1 ? row.stage_1_released_at : row.stage_2_released_at;
  if (alreadyReleased) {
    throw new PaymentsError(
      `Stage ${input.stage} of booking ${input.bookingId} was already released`,
    );
  }

  if (input.amountKobo > row.held_kobo - row.released_kobo) {
    throw new PaymentsError(
      `Release of ${input.amountKobo} exceeds the unreleased balance on booking ${input.bookingId}`,
    );
  }

  await gateway.releaseFunds({
    gatewayReference: row.gateway_reference,
    amountKobo: input.amountKobo,
    stage: input.stage,
    beneficiary: input.beneficiary,
    idempotencyKey: `${input.bookingId}:${input.stage}:${input.beneficiary.id}`,
  });

  const { error: ledgerError } = await db
    .from("payment_ledger_entries")
    .insert({
      payment_id: row.id,
      booking_id: input.bookingId,
      kind: "stage_release",
      amount_kobo: input.amountKobo,
      stage: input.stage,
      provider_id: input.beneficiary.id,
    });

  if (ledgerError) {
    // The gateway has moved money that the ledger does not know about. Loud, not
    // swallowed: this needs a human before the next release on this booking.
    throw new PaymentsError(
      `Funds released but the ledger write failed for booking ${input.bookingId}: ${ledgerError.message}`,
    );
  }

  const releasedKobo = row.released_kobo + input.amountKobo;

  // Commission is Nexa's and never releases to the provider, so the escrow is
  // fully settled when the provider's gross — held minus commission — has been
  // paid out, not when held_kobo hits zero. Comparing against held_kobo would
  // leave every booking stuck at partially_released forever.
  const providerGrossKobo = row.held_kobo - row.commission_kobo;

  const { error: updateError } = await db
    .from("payments")
    .update({
      released_kobo: releasedKobo,
      status: releasedKobo >= providerGrossKobo ? "released" : "partially_released",
      ...(input.stage === 1
        ? { stage_1_released_at: new Date().toISOString() }
        : { stage_2_released_at: new Date().toISOString() }),
    })
    .eq("id", row.id);

  if (updateError) {
    throw new PaymentsError(
      `Funds released but the payment row was not updated for booking ${input.bookingId}: ${updateError.message}`,
    );
  }

  // The wallet follows the money. A release is a bank transfer straight out of
  // Nexa's balance into the vendor's account, so it leaves `pending` and lands
  // in `withdrawn` — it has been paid, not parked. `available` is the
  // released-but-not-yet-transferred bucket, and in a direct-transfer model
  // nothing ever sits in it.
  await adjustWallet(db, input.beneficiary.id, {
    pendingKobo: -input.amountKobo,
    withdrawnKobo: input.amountKobo,
  });

  // A payout row is the vendor's withdrawal history (Studio,, and
  // the record that this much money left Nexa for this provider.
  await db.from("payouts").insert({
    provider_id: input.beneficiary.id,
    amount_kobo: input.amountKobo,
    status: "paid",
    gateway: gateway.name,
    gateway_reference: row.gateway_reference,
    paid_at: new Date().toISOString(),
  });
}

/**
 * Applies a late-arrival penalty.: 1% of booking value per 30
 * minutes late (or the provider's recorded override), split 30% to the affected
 * customer as compensation and 70% retained by Nexa.
 *
 * The penalty comes off the provider: their pending earnings drop by the whole
 * penalty, the customer is refunded their share, and Nexa keeps the rest. The
 * per-booking percentages were frozen at creation, so this is deterministic.
 */
export async function applyLatePenalty(input: {
  bookingId: string;
  lateMinutes: number;
}): Promise<{ penaltyKobo: Kobo; customerShareKobo: Kobo; platformShareKobo: Kobo }> {
  const db = createAdminClient();

  const { data: booking } = await db
    .from("bookings")
    .select("id, provider_id, customer_id, agreed_price_kobo, late_penalty_percent_per_30min")
    .eq("id", input.bookingId)
    .single();
  if (!booking) throw new PaymentsError(`No such booking ${input.bookingId}`);

  const { data: payment } = await db
    .from("payments")
    .select("id, gateway_reference, penalty_kobo")
    .eq("booking_id", input.bookingId)
    .single();
  if (!payment) throw new PaymentsError(`No payment for booking ${input.bookingId}`);

  const customerSharePercent = await getSettingNumeric(db, "penalty_customer_share_percent", 30);

  const split = calculateLatePenalty(
    booking.agreed_price_kobo,
    input.lateMinutes,
    booking.late_penalty_percent_per_30min,
    customerSharePercent,
  );
  if (split.penaltyKobo === 0) return split;

  // Record what was applied, with both shares, so the 30/70 is auditable.
  const { error: appError } = await db.from("penalty_applications").insert({
    booking_id: input.bookingId,
    payment_id: payment.id,
    reason: `Late arrival: ${input.lateMinutes} min`,
    late_minutes: input.lateMinutes,
    penalty_kobo: split.penaltyKobo,
    customer_share_kobo: split.customerShareKobo,
    platform_share_kobo: split.platformShareKobo,
  });
  if (appError) throw new PaymentsError(`Could not record the penalty: ${appError.message}`);

  // The customer's compensation is refunded to them; Nexa keeps its share.
  if (split.customerShareKobo > 0 && payment.gateway_reference) {
    await getPaymentGateway().refund({
      gatewayReference: payment.gateway_reference,
      amountKobo: split.customerShareKobo,
      reason: "Late-arrival compensation",
      idempotencyKey: `${input.bookingId}:penalty_comp`,
    });
  }

  await db.from("payment_ledger_entries").insert([
    {
      payment_id: payment.id,
      booking_id: input.bookingId,
      kind: "penalty",
      amount_kobo: -split.penaltyKobo,
      provider_id: booking.provider_id,
      note: `Late penalty (${input.lateMinutes} min)`,
    },
    {
      payment_id: payment.id,
      booking_id: input.bookingId,
      kind: "penalty",
      amount_kobo: split.customerShareKobo,
      customer_id: booking.customer_id,
      note: "Late-arrival compensation",
    },
  ]);

  await db.from("payments").update({ penalty_kobo: payment.penalty_kobo + split.penaltyKobo }).eq("id", payment.id);

  // Reduce the provider's pending earnings by the penalty.
  await adjustWallet(db, booking.provider_id, { pendingKobo: -split.penaltyKobo });

  return split;
}

export interface RefundInput {
  bookingId: string;
  amountKobo: Kobo;
  reason: string;
}

/** Returns money to the customer, in whole or in part. */
export async function refund(input: RefundInput): Promise<void> {
  const gateway = getPaymentGateway();
  const db = createAdminClient();

  const { data: payment, error } = await db
    .from("payments")
    .select("id, gateway_reference, booking_id, amount_kobo, commission_kobo")
    .eq("booking_id", input.bookingId)
    .single();

  if (error || !payment) {
    throw new PaymentsError(`No payment found for booking ${input.bookingId}`);
  }

  const row = payment;
  if (!row.gateway_reference) {
    throw new PaymentsError(`Booking ${input.bookingId} has no gateway reference to refund against`);
  }

  await gateway.refund({
    gatewayReference: row.gateway_reference,
    amountKobo: input.amountKobo,
    reason: input.reason,
    idempotencyKey: `${input.bookingId}:refund:${input.amountKobo}`,
  });

  const { error: ledgerError } = await db
    .from("payment_ledger_entries")
    .insert({
      payment_id: row.id,
      booking_id: input.bookingId,
      kind: "refund",
      amount_kobo: -input.amountKobo,
      note: input.reason,
    });

  if (ledgerError) {
    throw new PaymentsError(
      `Refund issued but the ledger write failed for booking ${input.bookingId}: ${ledgerError.message}`,
    );
  }

  // Money going back to the customer is money the vendor is no longer owed. The
  // refund is a share of the price, so the vendor's pending share of it comes
  // off — capped at zero, because a stage already released is gone from pending
  // and cannot be taken out of it twice.
  const providerId = await providerIdFor(db, input.bookingId);
  const providerShareKobo =
    row.amount_kobo > 0
      ? Math.round(
          (input.amountKobo * (row.amount_kobo - row.commission_kobo)) / row.amount_kobo,
        )
      : 0;
  if (providerShareKobo > 0) {
    await adjustWallet(db, providerId, { pendingKobo: -providerShareKobo });
  }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

type Db = ReturnType<typeof createAdminClient>;

async function getSettingNumeric(db: Db, key: string, fallback: number): Promise<number> {
  const { data } = await db.from("platform_settings").select("value").eq("key", key).maybeSingle();
  const n = Number(data?.value);
  return Number.isFinite(n) ? n : fallback;
}

async function providerIdFor(db: Db, bookingId: string): Promise<string> {
  const { data } = await db
    .from("bookings")
    .select("provider_id")
    .eq("id", bookingId)
    .single();

  if (!data) throw new PaymentsError(`No such booking ${bookingId}`);
  return data.provider_id;
}

/**
 * The only writer of a provider's balances. `guard_wallet_balance_write`
 * lets this through because it runs on the service role; a provider editing
 * their own wallet row is rejected by the same trigger.
 *
 * Balances are clamped at zero. A negative wallet is never a true statement
 * about money, and the check constraints on the table would reject it anyway.
 */
async function adjustWallet(
  db: Db,
  providerId: string,
  delta: { pendingKobo?: number; availableKobo?: number; withdrawnKobo?: number },
): Promise<void> {
  const { data: wallet } = await db
    .from("provider_wallets")
    .select("pending_kobo, available_kobo, withdrawn_kobo")
    .eq("provider_id", providerId)
    .maybeSingle();

  const next = {
    provider_id: providerId,
    pending_kobo: Math.max(0, (wallet?.pending_kobo ?? 0) + (delta.pendingKobo ?? 0)),
    available_kobo: Math.max(0, (wallet?.available_kobo ?? 0) + (delta.availableKobo ?? 0)),
    withdrawn_kobo: Math.max(0, (wallet?.withdrawn_kobo ?? 0) + (delta.withdrawnKobo ?? 0)),
    updated_at: new Date().toISOString(),
  };

  const { error } = await db
    .from("provider_wallets")
    .upsert(next, { onConflict: "provider_id" });

  if (error) {
    throw new PaymentsError(
      `Could not update the wallet for provider ${providerId}: ${error.message}`,
    );
  }
}

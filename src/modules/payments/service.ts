import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { getPaymentGateway } from "./gateway";
import { calculateLatePenalty } from "./calculations";
import type { Kobo } from "@/lib/money";

/**
 * The Payments module's public face. PRD Section 17.
 *
 * Booking logic calls holdFunds / releaseFunds / refund and nothing else. It
 * never sees a gateway, a checkout URL, or a Flutterwave reference. If a future
 * phase swaps the processor, every caller of this file keeps compiling.
 *
 * The write path runs on the service-role client on purpose: RLS grants nobody
 * INSERT on payment_ledger_entries, and the ledger's append-only trigger
 * refuses UPDATE and DELETE from every role including this one. Money is
 * recorded once, by this module, or not at all.
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
  amountKobo: Kobo;
  deliveryFeeKobo?: Kobo;
  cautionFeeKobo?: Kobo;
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
 * that is the entire premise of the platform (PRD Section 10).
 */
export async function holdFunds(input: HoldFundsInput): Promise<HoldFundsOutput> {
  const gateway = getPaymentGateway();
  const db = createAdminClient();

  const result = await gateway.holdFunds({
    reference: input.reference,
    amountKobo: input.amountKobo,
    deliveryFeeKobo: input.deliveryFeeKobo,
    cautionFeeKobo: input.cautionFeeKobo,
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
      delivery_fee_kobo: input.deliveryFeeKobo ?? 0,
      caution_fee_kobo: input.cautionFeeKobo ?? 0,
      commission_kobo: input.commissionKobo ?? 0,
      status: result.status === "held" ? "held" : "pending",
      held_kobo: result.status === "held" ? input.amountKobo : 0,
      caution_held_kobo: result.status === "held" ? (input.cautionFeeKobo ?? 0) : 0,
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
  await db.from("payment_ledger_entries").insert([
    {
      payment_id: data.id,
      booking_id: input.bookingId,
      kind: "hold",
      amount_kobo: input.amountKobo,
      customer_id: input.customer.id,
      note: "Escrow hold",
    },
    ...(input.cautionFeeKobo
      ? [
          {
            payment_id: data.id,
            booking_id: input.bookingId,
            kind: "caution_hold" as const,
            amount_kobo: input.cautionFeeKobo,
            customer_id: input.customer.id,
            note: "Caution fee held apart from escrow",
          },
        ]
      : []),
  ]);

  return { paymentId: data.id, checkoutUrl: result.checkoutUrl };
}

export interface ReleaseFundsInput {
  bookingId: string;
  stage: 1 | 2;
  amountKobo: Kobo;
  beneficiary: {
    kind: "provider" | "rider";
    id: string;
    bankCode: string;
    accountNumber: string;
  };
}

/**
 * Releases one stage's share to a provider or rider.
 *
 * The caller is responsible for having verified the checkpoint — a confirmation
 * code entered by the customer, not a provider tapping "done" (PRD Section 10).
 * This function does not know what a confirmation code is, and should not.
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
  if (alreadyReleased && input.beneficiary.kind === "provider") {
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
      kind: input.beneficiary.kind === "rider" ? "rider_payout" : "stage_release",
      amount_kobo: input.amountKobo,
      stage: input.stage,
      provider_id: input.beneficiary.kind === "provider" ? input.beneficiary.id : null,
      rider_id: input.beneficiary.kind === "rider" ? input.beneficiary.id : null,
    });

  if (ledgerError) {
    // The gateway has moved money that the ledger does not know about. Loud, not
    // swallowed: this needs a human before the next release on this booking.
    throw new PaymentsError(
      `Funds released but the ledger write failed for booking ${input.bookingId}: ${ledgerError.message}`,
    );
  }

  // Only a provider release consumes the escrow balance and closes a stage. A
  // rider's delivery fee is paid from the delivery fee, not from the money held
  // against the booking price (PRD Section 10).
  if (input.beneficiary.kind !== "provider") return;

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
}

export interface PayRiderInput {
  bookingId: string;
  riderId: string;
  amountKobo: Kobo;
  stage: 1 | 2;
  bankCode: string;
  accountNumber: string;
}

/**
 * Pays a rider their share of the delivery fee. PRD Section 10.
 *
 * A rider's money comes from the delivery fee the customer paid, NOT from the
 * escrow held against the booking price — "it is not part of the provider's
 * payout calculation." So this budgets against `delivery_fee_kobo` and the
 * rider payouts already made, entirely separate from provider releases.
 */
export async function payRider(input: PayRiderInput): Promise<void> {
  const gateway = getPaymentGateway();
  const db = createAdminClient();

  const { data: payment, error } = await db
    .from("payments")
    .select("id, gateway_reference, delivery_fee_kobo")
    .eq("booking_id", input.bookingId)
    .single();

  if (error || !payment) throw new PaymentsError(`No payment for booking ${input.bookingId}`);
  if (!payment.gateway_reference) {
    throw new PaymentsError(`Booking ${input.bookingId} has no gateway reference`);
  }

  const { data: prior } = await db
    .from("payment_ledger_entries")
    .select("amount_kobo")
    .eq("booking_id", input.bookingId)
    .eq("kind", "rider_payout");

  const alreadyPaid = (prior ?? []).reduce((sum, r) => sum + r.amount_kobo, 0);
  if (alreadyPaid + input.amountKobo > payment.delivery_fee_kobo) {
    throw new PaymentsError(
      `Rider payout of ${input.amountKobo} exceeds the remaining delivery fee on booking ${input.bookingId}`,
    );
  }

  await gateway.releaseFunds({
    gatewayReference: payment.gateway_reference,
    amountKobo: input.amountKobo,
    stage: input.stage,
    beneficiary: {
      kind: "rider",
      id: input.riderId,
      bankCode: input.bankCode,
      accountNumber: input.accountNumber,
    },
    idempotencyKey: `${input.bookingId}:rider:${input.riderId}:${input.stage}`,
  });

  const { error: ledgerError } = await db.from("payment_ledger_entries").insert({
    payment_id: payment.id,
    booking_id: input.bookingId,
    kind: "rider_payout",
    amount_kobo: input.amountKobo,
    stage: input.stage,
    rider_id: input.riderId,
    note: "Delivery fee",
  });
  if (ledgerError) {
    throw new PaymentsError(
      `Rider paid but the ledger write failed for booking ${input.bookingId}: ${ledgerError.message}`,
    );
  }

  // Rider earnings land as pending until the payout schedule settles them.
  const { data: wallet } = await db
    .from("rider_wallets")
    .select("pending_kobo")
    .eq("rider_id", input.riderId)
    .single();
  await db
    .from("rider_wallets")
    .update({ pending_kobo: (wallet?.pending_kobo ?? 0) + input.amountKobo })
    .eq("rider_id", input.riderId);
}

/**
 * Settles the caution fee on a returned rental. PRD Section 10.
 *
 * Good condition → the full caution fee is refunded to the customer when the
 * return code is confirmed. Damage reported → nothing is auto-deducted; a
 * dispute is raised for Admin, who decides the claim by hand.
 */
export async function settleCaution(input: {
  bookingId: string;
  damaged: boolean;
  notes?: string;
}): Promise<void> {
  const db = createAdminClient();

  const { data: payment, error } = await db
    .from("payments")
    .select("id, gateway_reference, caution_held_kobo, caution_refunded_kobo, booking_id")
    .eq("booking_id", input.bookingId)
    .single();

  if (error || !payment) throw new PaymentsError(`No payment for booking ${input.bookingId}`);

  const { data: booking } = await db
    .from("bookings")
    .select("customer_id")
    .eq("id", input.bookingId)
    .single();

  const outstanding = payment.caution_held_kobo - payment.caution_refunded_kobo;
  if (outstanding <= 0) return; // nothing held, or already settled

  if (input.damaged) {
    if (!booking?.customer_id) {
      throw new PaymentsError(`Booking ${input.bookingId} has no customer to attribute the dispute to`);
    }
    // Section 10: "a manual Admin decision, not an automatic deduction." The
    // dispute is over the customer's caution deposit, so it is raised in the
    // customer's name; Admin decides how much (if any) compensates the provider.
    const { error: disputeError } = await db.from("disputes").insert({
      booking_id: input.bookingId,
      raised_by: booking.customer_id,
      reason: "Damage reported at return",
      description: input.notes ?? null,
      is_damage_claim: true,
      caution_claim_kobo: outstanding,
    });
    if (disputeError) {
      throw new PaymentsError(`Could not raise the damage dispute: ${disputeError.message}`);
    }
    return;
  }

  if (payment.gateway_reference) {
    await getPaymentGateway().refund({
      gatewayReference: payment.gateway_reference,
      amountKobo: outstanding,
      reason: "Caution fee returned — item came back in good condition",
      idempotencyKey: `${input.bookingId}:caution_refund`,
    });
  }

  await db.from("payment_ledger_entries").insert({
    payment_id: payment.id,
    booking_id: input.bookingId,
    kind: "caution_refund",
    amount_kobo: -outstanding,
    customer_id: booking?.customer_id ?? null,
    note: "Caution fee refunded",
  });

  await db
    .from("payments")
    .update({ caution_refunded_kobo: payment.caution_refunded_kobo + outstanding })
    .eq("id", payment.id);
}

/**
 * Applies a late-arrival penalty. PRD Section 10: 1% of booking value per 30
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
  const { data: wallet } = await db
    .from("provider_wallets")
    .select("pending_kobo")
    .eq("provider_id", booking.provider_id)
    .single();
  await db
    .from("provider_wallets")
    .update({ pending_kobo: Math.max(0, (wallet?.pending_kobo ?? 0) - split.penaltyKobo) })
    .eq("provider_id", booking.provider_id);

  return split;
}

/**
 * Resolves a caution-fee damage claim. PRD Section 10: Admin reviews and can
 * deduct from the caution fee to compensate the provider, refunding any
 * remainder to the customer. A deliberate, manual decision — never automatic.
 */
export async function resolveCautionClaim(input: {
  bookingId: string;
  claimKobo: Kobo;
}): Promise<void> {
  const db = createAdminClient();

  const { data: payment } = await db
    .from("payments")
    .select("id, gateway_reference, caution_held_kobo, caution_refunded_kobo, caution_claimed_kobo")
    .eq("booking_id", input.bookingId)
    .single();
  if (!payment) throw new PaymentsError(`No payment for booking ${input.bookingId}`);

  const outstanding =
    payment.caution_held_kobo - payment.caution_refunded_kobo - payment.caution_claimed_kobo;
  if (input.claimKobo > outstanding) {
    throw new PaymentsError(`Claim exceeds the held caution fee (${outstanding} available)`);
  }

  const { data: booking } = await db
    .from("bookings")
    .select("provider_id, customer_id")
    .eq("id", input.bookingId)
    .single();

  const refundKobo = outstanding - input.claimKobo;

  // The claimed portion compensates the provider.
  if (input.claimKobo > 0) {
    await db.from("payment_ledger_entries").insert({
      payment_id: payment.id,
      booking_id: input.bookingId,
      kind: "caution_claim",
      amount_kobo: input.claimKobo,
      provider_id: booking?.provider_id ?? null,
      note: "Damage claim awarded from caution fee",
    });
  }

  // The remainder goes back to the customer.
  if (refundKobo > 0 && payment.gateway_reference) {
    await getPaymentGateway().refund({
      gatewayReference: payment.gateway_reference,
      amountKobo: refundKobo,
      reason: "Caution fee — remainder after damage claim",
      idempotencyKey: `${input.bookingId}:caution_claim_refund`,
    });
    await db.from("payment_ledger_entries").insert({
      payment_id: payment.id,
      booking_id: input.bookingId,
      kind: "caution_refund",
      amount_kobo: -refundKobo,
      customer_id: booking?.customer_id ?? null,
      note: "Caution fee remainder refunded",
    });
  }

  await db
    .from("payments")
    .update({
      caution_claimed_kobo: payment.caution_claimed_kobo + input.claimKobo,
      caution_refunded_kobo: payment.caution_refunded_kobo + refundKobo,
    })
    .eq("id", payment.id);
}

async function getSettingNumeric(
  db: ReturnType<typeof createAdminClient>,
  key: string,
  fallback: number,
): Promise<number> {
  const { data } = await db.from("platform_settings").select("value").eq("key", key).maybeSingle();
  const n = Number(data?.value);
  return Number.isFinite(n) ? n : fallback;
}

export interface RefundInput {
  bookingId: string;
  amountKobo: Kobo;
  reason: string;
}

/** Returns money to the customer, in whole or in part. PRD Sections 09, 10. */
export async function refund(input: RefundInput): Promise<void> {
  const gateway = getPaymentGateway();
  const db = createAdminClient();

  const { data: payment, error } = await db
    .from("payments")
    .select("id, gateway_reference, booking_id")
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
}

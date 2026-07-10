import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { getPaymentGateway } from "./gateway";
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

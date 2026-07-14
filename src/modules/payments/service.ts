import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { getPaymentGateway } from "./gateway";
import type { Kobo } from "@/lib/money";

/**
 * The Payments module's public face.
 *
 * Booking logic and the Admin Console call holdFunds / releaseFunds / refund and
 * nothing else. They never see a gateway, a checkout URL, or a Flutterwave
 * reference. If a future phase swaps the processor, every caller of this file
 * keeps compiling.
 *
 * THE MONEY MODEL (migration 0030)
 * ---------------------------------------------------------------------------
 * Nexa IS the escrow, and the model is as simple as it sounds:
 *
 *   1. the customer pays the WHOLE agreed price into Nexa
 *   2. Nexa holds all of it while the job happens
 *   3. the customer's confirmation code says the job was done
 *   4. an ADMIN releases money to the vendor — in full or in part, choosing the
 *      amount at that moment
 *
 * There are no percentages anywhere. Nexa does not compute a commission, a
 * deposit share or a penalty, because it no longer has a formula for any of them.
 * What Nexa keeps is whatever an admin did not release. Step 4 may happen more
 * than once; the only hard rule is that the releases can never add up to more
 * than what is being held.
 *
 * The write path runs on the service-role client on purpose: RLS grants nobody
 * INSERT on payment_ledger_entries, the ledger's append-only trigger refuses
 * UPDATE and DELETE from every role including this one, and
 * `guard_wallet_balance_write` rejects a wallet-balance write from anyone but
 * this module. Money is recorded once, by this file, or not at all.
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
  customer: { id: string; email: string; name?: string };
  redirectUrl: string;
}

export interface HoldFundsOutput {
  paymentId: string;
  checkoutUrl?: string;
  /**
   * "held" means the money is genuinely in Nexa's hands right now. "pending"
   * means the gateway has only issued a payment link — the customer has not paid
   * yet, and nothing may be released against this booking until the gateway's
   * webhook says the charge completed.
   */
  status: "pending" | "held";
}

/**
 * Takes the customer's money into escrow. Nothing reaches the provider here —
 * that is the entire premise of the platform.
 *
 * The full price lands in the vendor's wallet as *pending*: money that exists,
 * sitting in Nexa's balance, that they have not been paid. releaseFunds is what
 * turns pending into money in their bank account, and only an admin can call it.
 */
export async function holdFunds(input: HoldFundsInput): Promise<HoldFundsOutput> {
  const gateway = getPaymentGateway();
  const db = createAdminClient();

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

  // The ledger and the wallet only move when the MONEY moves. With a real
  // gateway the customer has merely been handed a payment link at this point;
  // writing a hold now would invent escrow that does not exist. The webhook
  // writes both when the charge actually completes. The mock gateway settles
  // instantly, so it lands here.
  if (result.status === "held") {
    await recordHold(db, {
      paymentId: data.id,
      bookingId: input.bookingId,
      amountKobo: input.amountKobo,
      customerId: input.customer.id,
    });
  }

  return { paymentId: data.id, checkoutUrl: result.checkoutUrl, status: result.status };
}

export interface ReleaseFundsInput {
  bookingId: string;
  /** However much of the hold the admin has decided the vendor has earned. */
  amountKobo: Kobo;
  beneficiary: {
    kind: "provider";
    id: string;
    bankCode: string;
    accountNumber: string;
  };
}

/**
 * Pays a vendor out of what Nexa is holding. ADMIN-DRIVEN: no booking event and
 * no checkpoint calls this, because no amount follows from one. A human looks at
 * a completed booking and decides what leaves escrow.
 *
 * It may be called repeatedly — an admin can release half now and the rest later,
 * or release part and keep the remainder. The single invariant is that the
 * releases can never exceed what is held. Anything still held after the last
 * release is what Nexa kept, and it is kept by never having been sent.
 *
 * `idempotencyKey` is derived, not random: it is built from how much had already
 * been released when this call started, so a retry of a release whose ledger
 * write failed reproduces the same key and the gateway pays once. Two *different*
 * partial releases produce two different keys and both go through, which is the
 * whole point.
 */
export async function releaseFunds(input: ReleaseFundsInput): Promise<void> {
  const gateway = getPaymentGateway();
  const db = createAdminClient();

  if (input.amountKobo <= 0) {
    throw new PaymentsError("A release must be more than zero");
  }

  const { data: payment, error: loadError } = await db
    .from("payments")
    .select("id, gateway_reference, held_kobo, released_kobo")
    .eq("booking_id", input.bookingId)
    .single();

  if (loadError || !payment) {
    throw new PaymentsError(`No payment found for booking ${input.bookingId}`);
  }

  const row = payment;
  if (!row.gateway_reference) {
    throw new PaymentsError(
      `Booking ${input.bookingId} has no gateway reference to release against`,
    );
  }

  const unreleasedKobo = row.held_kobo - row.released_kobo;
  if (input.amountKobo > unreleasedKobo) {
    throw new PaymentsError(
      `Release of ${input.amountKobo} kobo exceeds the ${unreleasedKobo} kobo still held on booking ${input.bookingId}`,
    );
  }

  await gateway.releaseFunds({
    gatewayReference: row.gateway_reference,
    amountKobo: input.amountKobo,
    beneficiary: input.beneficiary,
    idempotencyKey: `${input.bookingId}:${row.released_kobo}:${input.beneficiary.id}`,
  });

  const { error: ledgerError } = await db.from("payment_ledger_entries").insert({
    payment_id: row.id,
    booking_id: input.bookingId,
    kind: "stage_release",
    amount_kobo: input.amountKobo,
    // There are no stages any more: a release is an amount an admin chose, not a
    // checkpoint reached. The column stays for the rows written before 0030.
    stage: null,
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

  // "released" means the escrow is empty — everything the customer paid has left
  // for the vendor. A booking where Nexa kept a slice stays partially_released,
  // which is the true statement about it: money is still held.
  const { error: updateError } = await db
    .from("payments")
    .update({
      released_kobo: releasedKobo,
      status: releasedKobo >= row.held_kobo ? "released" : "partially_released",
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

  // A payout row is the vendor's withdrawal history in Business Studio, and the
  // record that this much money left Nexa for this provider.
  await db.from("payouts").insert({
    provider_id: input.beneficiary.id,
    amount_kobo: input.amountKobo,
    status: "paid",
    gateway: gateway.name,
    gateway_reference: row.gateway_reference,
    paid_at: new Date().toISOString(),
  });
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
    .select("id, gateway_reference, booking_id, amount_kobo")
    .eq("booking_id", input.bookingId)
    .single();

  if (error || !payment) {
    throw new PaymentsError(`No payment found for booking ${input.bookingId}`);
  }

  const row = payment;
  if (!row.gateway_reference) {
    throw new PaymentsError(
      `Booking ${input.bookingId} has no gateway reference to refund against`,
    );
  }

  await gateway.refund({
    gatewayReference: row.gateway_reference,
    amountKobo: input.amountKobo,
    reason: input.reason,
    idempotencyKey: `${input.bookingId}:refund:${input.amountKobo}`,
  });

  const { error: ledgerError } = await db.from("payment_ledger_entries").insert({
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

  // Money going back to the customer is money the vendor will never be paid, so
  // it comes out of their pending earnings. adjustWallet clamps at zero, which is
  // what makes this safe after a release: money already sent is gone from pending
  // and cannot be taken out of it twice.
  const providerId = await providerIdFor(db, input.bookingId);
  if (input.amountKobo > 0) {
    await adjustWallet(db, providerId, { pendingKobo: -input.amountKobo });
  }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

type Db = ReturnType<typeof createAdminClient>;

/**
 * The moment escrow becomes real: one ledger row for the hold, and the vendor's
 * pending earnings credited with the WHOLE price. Called either by holdFunds
 * (mock gateway, which settles instantly) or by the gateway webhook when the
 * customer's charge completes for real. Never both — the ledger is append-only,
 * and a second hold row would double every escrow figure in the Admin Console.
 */
export async function recordHold(
  db: Db,
  input: {
    paymentId: string;
    bookingId: string;
    amountKobo: number;
    customerId: string;
  },
): Promise<void> {
  await db.from("payment_ledger_entries").insert({
    payment_id: input.paymentId,
    booking_id: input.bookingId,
    kind: "hold",
    amount_kobo: input.amountKobo,
    customer_id: input.customerId,
    note: "Escrow hold",
  });

  // What the vendor stands to be paid, and cannot touch. Nexa may in the end
  // release less than this — that is an admin's call, made later.
  const providerId = await providerIdFor(db, input.bookingId);
  await adjustWallet(db, providerId, { pendingKobo: input.amountKobo });
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

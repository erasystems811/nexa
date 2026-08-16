import { createAdminClient } from "../../supabase.js";
import { getPaymentGateway } from "./gateway/index.js";
import type { Kobo } from "@nexa/money/src/money";

/**
 * Payments — escrow, releases, refunds, payouts. Ported from apps/customer's
 * modules/payments/service.ts — identical logic and identical safety model
 * (service-role only; RLS grants nobody a write here).
 *
 * THE MONEY MODEL (migration 0030): the customer pays the whole agreed price
 * into Nexa, Nexa holds it, the customer's confirmation code says the job
 * was done, and an ADMIN releases money to the vendor — in full or in part,
 * choosing the amount at that moment. What Nexa keeps is whatever an admin
 * did not release.
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
  customer: { id: string; email: string; name?: string };
  redirectUrl: string;
}

export interface HoldFundsOutput {
  paymentId: string;
  checkoutUrl?: string;
  status: "pending" | "held";
}

/** Takes the customer's money into escrow. Nothing reaches the provider here. */
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

  // With a real gateway, the customer has merely been handed a payment link
  // at this point; the webhook records the hold when the charge completes.
  // The mock gateway settles instantly, so it lands here.
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
  amountKobo: Kobo;
  beneficiary: {
    kind: "provider";
    id: string;
    bankCode: string;
    accountNumber: string;
  };
}

/**
 * Pays a vendor what a completed booking earns them: everything Nexa is
 * holding, less commission (read from platform settings at payout time),
 * less anything already released early as a deposit. Returns how much was
 * sent — zero is a valid answer.
 */
export async function settleVendorPayout(bookingId: string): Promise<number> {
  const db = createAdminClient();

  const [{ data: booking }, { data: payment }] = await Promise.all([
    db.from("bookings").select("provider_id").eq("id", bookingId).maybeSingle(),
    db.from("payments").select("held_kobo, released_kobo, refunded_kobo").eq("booking_id", bookingId).maybeSingle(),
  ]);
  if (!booking || !payment || payment.held_kobo <= 0) return 0;

  const { data: setting } = await db
    .from("platform_settings")
    .select("value")
    .eq("key", "commission_percent")
    .maybeSingle();
  const commissionPercent = Math.min(100, Math.max(0, Number(setting?.value ?? 0)));

  const entitlement = Math.round(payment.held_kobo * (1 - commissionPercent / 100));
  const stillHeld = payment.held_kobo - payment.released_kobo - (payment.refunded_kobo ?? 0);
  const toRelease = Math.max(0, Math.min(stillHeld, entitlement - payment.released_kobo));
  if (toRelease <= 0) return 0;

  const { data: wallet } = await db
    .from("provider_wallets")
    .select("bank_code, bank_account_number")
    .eq("provider_id", booking.provider_id)
    .maybeSingle();
  if (!wallet?.bank_code || !wallet.bank_account_number) {
    throw new PaymentsError(
      "Add your bank account in Business Studio first, so Nexa knows where to send your money.",
    );
  }

  await releaseFunds({
    bookingId,
    amountKobo: toRelease,
    beneficiary: {
      kind: "provider",
      id: booking.provider_id,
      bankCode: wallet.bank_code,
      accountNumber: wallet.bank_account_number,
    },
  });

  return toRelease;
}

/** Just the check: is there a bank account to pay into? */
export async function vendorCanBePaid(bookingId: string): Promise<boolean> {
  const db = createAdminClient();
  const { data: booking } = await db.from("bookings").select("provider_id").eq("id", bookingId).maybeSingle();
  if (!booking) return false;
  const { data: wallet } = await db
    .from("provider_wallets")
    .select("bank_code, bank_account_number")
    .eq("provider_id", booking.provider_id)
    .maybeSingle();
  return Boolean(wallet?.bank_code && wallet.bank_account_number);
}

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
    throw new PaymentsError(`Booking ${input.bookingId} has no gateway reference to release against`);
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
    stage: null,
    provider_id: input.beneficiary.id,
  });

  if (ledgerError) {
    throw new PaymentsError(
      `Funds released but the ledger write failed for booking ${input.bookingId}: ${ledgerError.message}`,
    );
  }

  const releasedKobo = row.released_kobo + input.amountKobo;

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

  await adjustWallet(db, input.beneficiary.id, {
    pendingKobo: -input.amountKobo,
    withdrawnKobo: input.amountKobo,
  });

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
    throw new PaymentsError(`Booking ${input.bookingId} has no gateway reference to refund against`);
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
 * The moment escrow becomes real: one ledger row for the hold, and the
 * vendor's pending earnings credited with the whole price. Called either by
 * holdFunds (mock gateway, instant) or by the gateway webhook when a real
 * charge completes. Never both.
 */
export async function recordHold(
  db: Db,
  input: { paymentId: string; bookingId: string; amountKobo: number; customerId: string },
): Promise<void> {
  await db.from("payment_ledger_entries").insert({
    payment_id: input.paymentId,
    booking_id: input.bookingId,
    kind: "hold",
    amount_kobo: input.amountKobo,
    customer_id: input.customerId,
    note: "Escrow hold",
  });

  const providerId = await providerIdFor(db, input.bookingId);
  await adjustWallet(db, providerId, { pendingKobo: input.amountKobo });
}

async function providerIdFor(db: Db, bookingId: string): Promise<string> {
  const { data } = await db.from("bookings").select("provider_id").eq("id", bookingId).single();
  if (!data) throw new PaymentsError(`No such booking ${bookingId}`);
  return data.provider_id;
}

/** The only writer of a provider's balances. Balances are clamped at zero. */
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

  const { error } = await db.from("provider_wallets").upsert(next, { onConflict: "provider_id" });

  if (error) {
    throw new PaymentsError(`Could not update the wallet for provider ${providerId}: ${error.message}`);
  }
}

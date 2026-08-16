import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { serverEnv } from "@/lib/env";
// A gateway callback has no user session to scope a client to, and it writes the money columns
// that RLS grants nobody INSERT on. admin.ts names this exact case — "the payments service moving
// money, the bookings state machine, gateway webhooks" — as what the service-role client is for.
// This is not a page or a component: nothing user-controlled is rendered, and the only writes are
// to rows the sender was authenticated against.
// eslint-disable-next-line no-restricted-imports -- see above
import { createAdminClient } from "@/lib/supabase/admin";
import { recordHold } from "@/modules/payments";
import { notifyVendorOfNewBooking } from "@/modules/messaging/whatsapp";
import type { Json } from "@/lib/db/generated";

/**
 * Flutterwave callbacks.
 *
 * This is the only place that learns a customer actually paid. `holdFunds`
 * hands back a checkout link and writes the payment row as `pending`; the money
 * is not Nexa's until Flutterwave says it is, and Flutterwave says it here.
 *
 * Three things have to be true of this route, in this order:
 *
 *   1. It is authentic. Flutterwave does not sign its webhooks — it echoes back
 *      the "secret hash" configured in its dashboard in a `verif-hash` header.
 *      Anything that fails that check is 401 and is not parsed, let alone acted
 *      on. Releasing money on a forged callback is how a marketplace dies.
 *   2. It happens once. Flutterwave retries. `payment_webhook_events` has a
 *      unique (gateway, event_id), so a retry of an event already *processed*
 *      is acknowledged and dropped. A retry of one that was received but failed
 *      mid-way is deliberately re-run — the row exists but `processed_at` does
 *      not.
 *   3. It never throws at the client. Every failure is caught, recorded on the
 *      event row, and answered with a status code: 200 when there is nothing to
 *      retry, 500 when there is.
 *
 * It verifies the header itself rather than calling the gateway's parseWebhook:
 * `modules/payments/gateway` is private to the payments module, and
 * a route is not the payments module.
 */

const GATEWAY = "flutterwave";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const secret = serverEnv().FLUTTERWAVE_WEBHOOK_SECRET;

  // No secret configured is not "let it through". It is "this endpoint cannot
  // authenticate anything", which is a 401 for every caller.
  if (!secret) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const rawBody = await request.text();
  const verifHash = request.headers.get("verif-hash");

  if (!verifHash || !matchesSecretHash(verifHash, secret)) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  let payload: FlutterwavePayload;
  try {
    payload = JSON.parse(rawBody) as FlutterwavePayload;
  } catch {
    // Authentic sender, unreadable body. Retrying will not fix it.
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const eventType = String(payload.event ?? "unknown");
  const data = payload.data ?? {};
  const eventId = `${eventType}:${String(data.id ?? data.flw_ref ?? data.tx_ref ?? "unknown")}`;

  const db = createAdminClient();

  // Claim the event. The unique (gateway, event_id) is the idempotency lock.
  const { error: insertError } = await db.from("payment_webhook_events").insert({
    gateway: GATEWAY,
    event_id: eventId,
    event_type: eventType,
    payload: payload as unknown as Json,
  });

  if (insertError) {
    // 23505 = unique violation: seen before. Finished before? Then we are done.
    // Unfinished? Then this retry is the second chance, and we take it.
    if (insertError.code !== "23505") {
      return NextResponse.json({ ok: false }, { status: 500 });
    }

    const { data: seen } = await db
      .from("payment_webhook_events")
      .select("processed_at")
      .eq("gateway", GATEWAY)
      .eq("event_id", eventId)
      .maybeSingle();

    if (seen?.processed_at) {
      return NextResponse.json({ ok: true, duplicate: true });
    }
  }

  try {
    if (eventType === "charge.completed" && isSuccessful(data.status)) {
      await recordCompletedCharge(db, data);
    }

    await db
      .from("payment_webhook_events")
      .update({ processed_at: new Date().toISOString(), error: null })
      .eq("gateway", GATEWAY)
      .eq("event_id", eventId);

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown webhook failure";

    // Left with processed_at null on purpose: a Flutterwave retry re-runs it.
    await db
      .from("payment_webhook_events")
      .update({ error: message.slice(0, 1000) })
      .eq("gateway", GATEWAY)
      .eq("event_id", eventId);

    return NextResponse.json({ ok: false }, { status: 500 });
  }
}

/**
 * The customer has paid. Turn the pending payment row into a real hold — the
 * whole agreed price, into Nexa's hands, where it stays until an admin releases
 * it.
 *
 * `held_kobo` and the status are set from the payment row's own figures, never
 * from anything the callback claims.
 *
 * `gateway_reference` is overwritten with Flutterwave's numeric transaction id.
 * Until now it held the tx_ref (the booking reference), because the payment-link
 * call returns no id. Refunds are addressed by transaction id, so this write is
 * what makes a later refund possible at all.
 */
async function recordCompletedCharge(
  db: ReturnType<typeof createAdminClient>,
  data: FlutterwaveChargeData,
): Promise<void> {
  const txRef = typeof data.tx_ref === "string" ? data.tx_ref : null;
  const transactionId = data.id !== undefined && data.id !== null ? String(data.id) : null;

  if (!txRef || !transactionId) {
    throw new Error(`charge.completed without a tx_ref or an id (tx_ref=${String(txRef)})`);
  }

  const { data: payment, error } = await db
    .from("payments")
    .select("id, booking_id, status, amount_kobo, held_kobo, gateway_reference, bookings ( customer_id )")
    .eq("gateway", GATEWAY)
    .eq("gateway_reference", txRef)
    .maybeSingle();

  if (error) {
    throw new Error(`Could not load the payment for ${txRef}: ${error.message}`);
  }

  if (!payment) {
    // Either this charge is not ours, or it is a retry arriving after the row's
    // reference was already advanced to the transaction id. Both are settled
    // states, not failures: nothing to do, and nothing to retry.
    return;
  }

  if (payment.status !== "pending") {
    return; // Already held, released, or refunded. Not our business twice.
  }

  // What Flutterwave says was charged, against what Nexa asked for. A callback
  // that is authentic can still be for less money than the booking costs — a
  // customer who edited the amount on the checkout page, a partial capture — and
  // holding an under-paid booking as if it were paid is a real loss.
  // The agreed price IS the whole charge — nothing is added on top.
  const expectedKobo = payment.amount_kobo;
  const paidKobo = nairaToKobo(data.amount);

  if (paidKobo === null || paidKobo < expectedKobo) {
    throw new Error(
      `Underpayment on ${txRef}: Flutterwave charged ${String(paidKobo)} kobo against ${expectedKobo} expected`,
    );
  }

  if (typeof data.currency === "string" && data.currency.toUpperCase() !== "NGN") {
    throw new Error(`Charge on ${txRef} settled in ${data.currency}, not NGN`);
  }

  const { error: updateError } = await db
    .from("payments")
    .update({
      status: "held",
      held_kobo: payment.amount_kobo,
      gateway_reference: transactionId,
      gateway_metadata: {
        tx_ref: txRef,
        transaction_id: transactionId,
        flw_ref: data.flw_ref ?? null,
        charged_amount: data.amount ?? null,
        currency: data.currency ?? null,
        payment_type: data.payment_type ?? null,
        charge_status: data.status ?? null,
      } as unknown as Json,
    })
    .eq("id", payment.id)
    // Only from pending. Two concurrent deliveries of the same charge cannot
    // both win this: the second updates zero rows.
    .eq("status", "pending");

  if (updateError) {
    throw new Error(`Could not mark ${txRef} as held: ${updateError.message}`);
  }

  // NOW the escrow is real, so now it goes in the ledger and the vendor's
  // pending earnings. `holdFunds` deliberately did not write these when it
  // issued the payment link — at that point the customer had paid nothing, and
  // a hold row would have invented escrow that did not exist.
  //
  // The status guard on the UPDATE above is what makes this safe to run once:
  // a concurrent redelivery of the same charge updates zero rows and never
  // reaches here, so the append-only ledger cannot get a second hold.
  const customerId = (payment.bookings as unknown as { customer_id: string } | null)?.customer_id;
  if (customerId) {
    await recordHold(db, {
      paymentId: payment.id,
      bookingId: payment.booking_id,
      amountKobo: payment.amount_kobo,
      customerId,
    });
  }

  // The customer has paid, so the booking becomes bookable: this transition is
  // what mints their completion code. Refuses to drag a booking that has already
  // moved on backwards.
  const { data: booking } = await db
    .from("bookings")
    .select("status")
    .eq("id", payment.booking_id)
    .maybeSingle();

  if (booking && booking.status === "pending") {
    await db.from("bookings").update({ status: "paid_held" }).eq("id", payment.booking_id);
    try {
      await notifyVendorOfNewBooking(payment.booking_id);
    } catch {
      // Best-effort: the booking itself is already correctly paid and held.
    }
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface FlutterwaveChargeData {
  id?: number | string;
  tx_ref?: string;
  flw_ref?: string;
  amount?: number | string;
  currency?: string;
  status?: string;
  payment_type?: string;
}

interface FlutterwavePayload {
  event?: string;
  data?: FlutterwaveChargeData;
}

/**
 * Constant-time compare of the `verif-hash` header against the configured secret
 * hash. Both sides are digested first so the comparison is fixed-length:
 * timingSafeEqual throws on a length mismatch, which would otherwise let a
 * prober learn how long the secret is.
 */
function matchesSecretHash(received: string, expected: string): boolean {
  const a = createHash("sha256").update(received, "utf8").digest();
  const b = createHash("sha256").update(expected, "utf8").digest();
  return timingSafeEqual(a, b);
}

function isSuccessful(status: unknown): boolean {
  return typeof status === "string" && status.toLowerCase() === "successful";
}

/** Flutterwave talks in naira, the app stores kobo. Nothing in between is a float. */
function nairaToKobo(amount: number | string | undefined): number | null {
  const naira = typeof amount === "string" ? Number(amount) : amount;
  if (typeof naira !== "number" || !Number.isFinite(naira)) return null;
  return Math.round(naira * 100);
}

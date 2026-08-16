import "server-only";

import { adminDb, audit, AdminError } from "./context";
import type { Database } from "@/lib/db/generated";

/**
 * Vendor subscriptions — the monthly platform fee (migration 0028).
 *
 * Nexa has two revenue lines: commission on each booking, and this fee. A vendor
 * who falls behind is hidden from the marketplace by RLS (provider_is_listable),
 * not by anything in this file — they keep Business Studio, their bookings, and
 * their money; they simply stop being findable. Admin's job here is to see the
 * status and, since Flutterwave cannot auto-bill yet, to record the payment.
 *
 * Recording a payment is deliberately two writes: an immutable receipt in
 * subscription_payments, and the subscription row rolled forward. When automated
 * billing lands, the webhook writes the same two rows and nothing else changes.
 */

export type SubscriptionStatus = Database["public"]["Enums"]["subscription_status"];

export const SUBSCRIPTION_STATUSES = [
  "trialing",
  "active",
  "past_due",
  "cancelled",
] as const satisfies readonly SubscriptionStatus[];

/** What each status means for the marketplace — the sentence Admin actually needs. */
export const SUBSCRIPTION_STATUS_COPY: Record<
  SubscriptionStatus,
  { label: string; meaning: string; visible: boolean }
> = {
  trialing: {
    label: "Trial",
    meaning: "Signed up, never billed yet. Still visible to customers.",
    visible: true,
  },
  active: {
    label: "Paid",
    meaning: "Paid up for the current period. Visible to customers.",
    visible: true,
  },
  past_due: {
    label: "Past due",
    meaning: "The period ended unpaid — hidden from the marketplace until it is paid.",
    visible: false,
  },
  cancelled: {
    label: "Cancelled",
    meaning: "Ended, by the vendor or by Admin — hidden from the marketplace.",
    visible: false,
  },
};

/** One month forward, clamped: 31 Jan + 1 month is 28/29 Feb, not 3 March. */
function addOneMonth(from: Date): Date {
  const d = new Date(from);
  const day = d.getDate();
  d.setMonth(d.getMonth() + 1);
  if (d.getDate() < day) d.setDate(0); // overshot into the next month — step back.
  return d;
}

export async function listSubscriptions(status?: string) {
  const db = adminDb();
  let q = db
    .from("provider_subscriptions")
    .select(
      "provider_id, status, amount_kobo, current_period_start, current_period_end, last_paid_at, cancelled_at, providers ( business_name, status )",
    )
    .order("current_period_end", { ascending: true, nullsFirst: true });
  if (status) q = q.eq("status", status as SubscriptionStatus);
  const { data } = await q;
  return data ?? [];
}

/** The headline numbers: who is paying, who has lapsed, what it adds up to. */
export async function subscriptionOverview() {
  const db = adminDb();
  const [{ data: subs }, { data: paid }] = await Promise.all([
    db.from("provider_subscriptions").select("status, amount_kobo"),
    db.from("subscription_payments").select("amount_kobo, paid_at"),
  ]);

  const rows = subs ?? [];
  const count = (s: SubscriptionStatus) => rows.filter((r) => r.status === s).length;

  const thisMonth = new Date().toISOString().slice(0, 7);
  const collectedThisMonth = (paid ?? [])
    .filter((p) => p.paid_at.slice(0, 7) === thisMonth)
    .reduce((a, p) => a + p.amount_kobo, 0);

  return {
    total: rows.length,
    active: count("active"),
    trialing: count("trialing"),
    pastDue: count("past_due"),
    cancelled: count("cancelled"),
    /** What the paying vendors are worth per month at today's prices. */
    monthlyKobo: rows.filter((r) => r.status === "active").reduce((a, r) => a + r.amount_kobo, 0),
    collectedThisMonth,
    collectedAllTime: (paid ?? []).reduce((a, p) => a + p.amount_kobo, 0),
  };
}

/** The subscription and its receipts, for the vendor's detail page. */
export async function getProviderSubscription(providerId: string) {
  const db = adminDb();
  const [{ data: subscription }, { data: payments }] = await Promise.all([
    db.from("provider_subscriptions").select("*").eq("provider_id", providerId).maybeSingle(),
    db
      .from("subscription_payments")
      .select("id, amount_kobo, paid_at, gateway, gateway_reference")
      .eq("provider_id", providerId)
      .order("paid_at", { ascending: false })
      .limit(12),
  ]);
  return { subscription, payments: payments ?? [] };
}

/**
 * Record a payment for the current period. Flutterwave cannot auto-bill a
 * subscription yet, so a person confirms the transfer and clicks this — hence
 * `gateway: 'manual'` and `recorded_by`. An automated webhook would write the
 * identical pair of rows with its own gateway reference.
 *
 * Paying early extends rather than truncates: the new period starts at the end
 * of the one still running, so a vendor is never billed for time they lose.
 */
export async function markSubscriptionPaid(
  actorId: string,
  providerId: string,
  amountKobo?: number,
): Promise<void> {
  const db = adminDb();

  const { data: sub } = await db
    .from("provider_subscriptions")
    .select("*")
    .eq("provider_id", providerId)
    .maybeSingle();
  if (!sub) throw new AdminError("This vendor has no subscription row");

  const amount = amountKobo ?? sub.amount_kobo;
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new AdminError("The amount paid must be more than zero");
  }

  const now = new Date();
  const runningUntil = sub.current_period_end ? new Date(sub.current_period_end) : null;
  const periodStart = runningUntil && runningUntil > now ? runningUntil : now;
  const periodEnd = addOneMonth(periodStart);

  const { error: payErr } = await db.from("subscription_payments").insert({
    provider_id: providerId,
    amount_kobo: amount,
    paid_at: now.toISOString(),
    gateway: "manual",
    recorded_by: actorId,
  });
  if (payErr) throw new AdminError(`Could not record the payment: ${payErr.message}`);

  const { error } = await db
    .from("provider_subscriptions")
    .update({
      status: "active",
      current_period_start: periodStart.toISOString(),
      current_period_end: periodEnd.toISOString(),
      last_paid_at: now.toISOString(),
      cancelled_at: null,
    })
    .eq("provider_id", providerId);
  if (error) throw new AdminError(error.message);

  await audit(actorId, "subscription_paid", "provider", providerId, sub, {
    amountKobo: amount,
    periodEnd: periodEnd.toISOString(),
  });
}

/**
 * Mark past due, cancel, or reactivate. past_due and cancelled both hide the
 * vendor from the marketplace (RLS decides that, not us) — this only states the
 * fact. Reactivating a vendor whose period has already lapsed puts them back to
 * past_due rather than pretending they paid; record a payment to make them
 * active.
 */
export async function setSubscriptionStatus(
  actorId: string,
  providerId: string,
  status: SubscriptionStatus,
): Promise<void> {
  const db = adminDb();

  const { data: sub } = await db
    .from("provider_subscriptions")
    .select("*")
    .eq("provider_id", providerId)
    .maybeSingle();
  if (!sub) throw new AdminError("This vendor has no subscription row");

  let next: SubscriptionStatus = status;
  if (status === "active") {
    const end = sub.current_period_end ? new Date(sub.current_period_end) : null;
    if (!end) next = "trialing";
    else if (end <= new Date()) next = "past_due";
  }

  const { error } = await db
    .from("provider_subscriptions")
    .update({
      status: next,
      cancelled_at: next === "cancelled" ? new Date().toISOString() : null,
    })
    .eq("provider_id", providerId);
  if (error) throw new AdminError(error.message);

  await audit(actorId, "subscription_status", "provider", providerId, { status: sub.status }, { status: next });
}

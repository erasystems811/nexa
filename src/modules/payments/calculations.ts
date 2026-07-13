import { splitByPercent, type Kobo } from "@/lib/money";

/**
 * Pure escrow arithmetic. No database, no gateway, no clock — so the numbers
 * that decide who gets paid what can be reasoned about and tested directly.
 *
 * Every percentage arrives as an argument. None is read from a constant here;
 * they are frozen onto the booking at creation from platform settings and the
 * provider agreement
 */

export interface BookingTerms {
  agreedPriceKobo: Kobo;
  commissionPercent: number;
  stage1ReleasePercent: number;
  latePenaltyPercentPer30Min: number;
}

export interface PayoutBreakdown {
  /** What Nexa keeps from the booking price. */
  commissionKobo: Kobo;
  /** What the provider is owed in total, before penalties. */
  providerGrossKobo: Kobo;
  /** Released at the stage-1 checkpoint. */
  stage1Kobo: Kobo;
  /** Released when the customer's confirmation code is entered. */
  stage2Kobo: Kobo;
}

/**
 * Commission comes off the top; the remainder is what the provider earns, split
 * across the two checkpoints. A stage-1 percentage of 0 collapses this to a
 * single release on the confirmation code — which is what's
 * "single full release" resolution describes, expressed as a setting rather
 * than as a different code path.
 */
export function calculatePayout(terms: BookingTerms): PayoutBreakdown {
  const [commissionKobo, providerGrossKobo] = splitByPercent(
    terms.agreedPriceKobo,
    terms.commissionPercent,
  );
  const [stage1Kobo, stage2Kobo] = splitByPercent(
    providerGrossKobo,
    terms.stage1ReleasePercent,
  );

  return { commissionKobo, providerGrossKobo, stage1Kobo, stage2Kobo };
}

export interface PenaltyBreakdown {
  penaltyKobo: Kobo;
  /** Compensation paid to the affected customer. */
  customerShareKobo: Kobo;
  /** Retained by Nexa. */
  platformShareKobo: Kobo;
}

/**
 *: "1% of booking value deducted from provider payout per 30
 * minutes late". A 29-minute delay is not yet a penalty; 30 minutes is one
 * increment. The penalty can never exceed the booking value.
 */
export function calculateLatePenalty(
  agreedPriceKobo: Kobo,
  lateMinutes: number,
  penaltyPercentPer30Min: number,
  customerSharePercent: number,
): PenaltyBreakdown {
  const increments = Math.floor(Math.max(0, lateMinutes) / 30);
  const rawPercent = increments * penaltyPercentPer30Min;
  const cappedPercent = Math.min(rawPercent, 100);

  const [penaltyKobo] = splitByPercent(agreedPriceKobo, cappedPercent);
  const [customerShareKobo, platformShareKobo] = splitByPercent(
    penaltyKobo,
    customerSharePercent,
  );

  return { penaltyKobo, customerShareKobo, platformShareKobo };
}

/**
 *: before acceptance the customer always gets everything back.
 * After acceptance, the provider's own tiered policy decides — "calculated
 * automatically, never manual".
 *
 * `policy` is the listing's cancellation_policy JSON: the tiers are matched
 * most-generous-first, and an unmatched cancellation refunds nothing.
 */
export interface CancellationTier {
  min_hours_before: number;
  refund_percent: number;
}

export function calculateRefund(
  agreedPriceKobo: Kobo,
  hoursUntilEvent: number,
  providerHasAccepted: boolean,
  policy: CancellationTier[],
): Kobo {
  if (!providerHasAccepted) return agreedPriceKobo;

  const tier = [...policy]
    .sort((a, b) => b.min_hours_before - a.min_hours_before)
    .find((t) => hoursUntilEvent >= t.min_hours_before);

  if (!tier) return 0;
  const [refund] = splitByPercent(agreedPriceKobo, tier.refund_percent);
  return refund;
}

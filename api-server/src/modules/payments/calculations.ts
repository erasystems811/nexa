import { splitByPercent, type Kobo } from "@nexa/money/src/money";

/**
 * Pure money arithmetic. Ported from apps/customer's
 * modules/payments/calculations.ts — unchanged. No database, no gateway, no
 * clock. The one formula left is the vendor's own published cancellation
 * policy — Nexa itself no longer computes anyone's cut (0030).
 */

export interface CancellationTier {
  min_hours_before: number;
  refund_percent: number;
}

/**
 * Before the vendor has accepted, the customer always gets everything back.
 * After acceptance, the vendor's own tiered policy decides: tiers are
 * matched most-generous-first, and a cancellation matching no tier refunds
 * nothing.
 */
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

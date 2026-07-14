import { splitByPercent, type Kobo } from "@/lib/money";

/**
 * Pure money arithmetic. No database, no gateway, no clock.
 *
 * There is exactly one calculation left on this platform, and it is not Nexa's.
 * Nexa does not compute anybody's cut: the customer's whole payment is held, and
 * an admin later decides how much of it reaches the vendor. What Nexa keeps, if
 * anything, is simply what was not released — a human decision, not a formula.
 *
 * The one thing that IS a formula is the VENDOR's own cancellation policy, below.
 * It is the vendor's promise to their customer, published on their listing, so it
 * has to be applied the same way every time.
 */

/**
 * A tier of the listing's cancellation_policy JSON: "cancel this many hours
 * before the event and you get this much of your money back".
 */
export interface CancellationTier {
  min_hours_before: number;
  refund_percent: number;
}

/**
 * Before the vendor has accepted, the customer always gets everything back —
 * nobody has committed to anything yet. After acceptance the vendor's own tiered
 * policy decides: tiers are matched most-generous-first, and a cancellation that
 * matches no tier refunds nothing.
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

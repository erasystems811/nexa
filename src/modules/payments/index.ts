/**
 * Payments — escrow, releases, refunds, payouts. PRD Sections 10, 17.
 *
 * This barrel is the ONLY entry point. `modules/payments/gateway/*` is private:
 * eslint.config.mjs blocks importing it from anywhere else, so booking logic
 * cannot reach a processor even by accident.
 *
 *   Booking logic  ->  payments.holdFunds()  ->  PaymentGateway  ->  Flutterwave
 *                                                     ^
 *                                          swappable here, only here
 */
export {
  holdFunds,
  releaseFunds,
  settleCaution,
  applyLatePenalty,
  resolveCautionClaim,
  refund,
  PaymentsError,
  type HoldFundsInput,
  type HoldFundsOutput,
  type ReleaseFundsInput,
  type RefundInput,
} from "./service";

export {
  calculatePayout,
  calculateLatePenalty,
  calculateRefund,
  type BookingTerms,
  type PayoutBreakdown,
  type PenaltyBreakdown,
  type CancellationTier,
} from "./calculations";

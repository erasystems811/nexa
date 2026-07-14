/**
 * Payments — escrow, releases, refunds, payouts.
 *
 * This barrel is the ONLY entry point. `modules/payments/gateway/*` is private:
 * eslint.config.mjs blocks importing it from anywhere else, so booking logic
 * cannot reach a processor even by accident.
 *
 *   Booking logic  ->  payments.holdFunds  ->  PaymentGateway  ->  Flutterwave
 *   Admin Console  ->  payments.releaseFunds / refund                  ^
 *                                                      swappable here, only here
 *
 * Booking logic holds money. Only the Admin Console gets it out again.
 */
export {
  holdFunds,
  recordHold,
  releaseFunds,
  refund,
  PaymentsError,
  type HoldFundsInput,
  type HoldFundsOutput,
  type ReleaseFundsInput,
  type RefundInput,
} from "./service";

export { calculateRefund, type CancellationTier } from "./calculations";

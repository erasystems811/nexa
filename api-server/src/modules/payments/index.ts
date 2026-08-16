/**
 * Payments — escrow, releases, refunds, payouts. Ported from apps/customer's
 * modules/payments/index.ts.
 *
 * This barrel is the ONLY entry point. modules/payments/gateway/* is
 * private: eslint.config.mjs blocks importing it from anywhere else in this
 * server, so booking logic cannot reach a processor even by accident.
 *
 *   Booking logic  ->  payments.holdFunds  ->  PaymentGateway  ->  Flutterwave
 *   Admin route     ->  payments.releaseFunds / refund                  ^
 *                                                      swappable here, only here
 */
export {
  holdFunds,
  recordHold,
  settleVendorPayout,
  vendorCanBePaid,
  releaseFunds,
  refund,
  PaymentsError,
  type HoldFundsInput,
  type HoldFundsOutput,
  type ReleaseFundsInput,
  type RefundInput,
} from "./service.js";

export { calculateRefund, type CancellationTier } from "./calculations.js";
export { listBanks, bankName, type Bank } from "./banks.js";

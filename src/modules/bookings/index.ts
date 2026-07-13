/**
 * Bookings — the lifecycle state machine.
 *
 * Owns: bookings, booking_confirmation_codes, price_offers, event_projects.
 *
 * Calls `@/modules/payments` for every movement of money, and never a payment
 * processor. It does not know Flutterwave exists.
 *
 * The rule this module exists to enforce: the booking completes, and the vendor
 * gets the balance, only when the CUSTOMER's confirmation code is entered —
 * never when a vendor taps "done".
 */
export {
  checkout,
  acceptBooking,
  rejectBooking,
  startWork,
  confirmWithCode,
  BookingsError,
  type CheckoutInput,
  type CheckoutResult,
} from "./service";

export { listMyOrders, getMyOrder } from "./queries";
export { listOffers, sendOffer, acceptOffer } from "./offers";
export {
  TRANSITIONS,
  canTransition,
  assertTransition,
  checkpointsFor,
  codeCountFor,
  type StageCheckpoint,
} from "./state";

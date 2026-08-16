/**
 * Bookings — the lifecycle state machine. Ported from apps/customer's
 * modules/bookings/index.ts.
 *
 * Owns: bookings, booking_confirmation_codes, price_offers, event_projects.
 * Calls ../payments for every movement of money, never a payment processor.
 * A booking completes only when the CUSTOMER's confirmation code is entered
 * — never when a vendor taps "done". Completing pays nobody by itself; an
 * admin releases more (or refunds) afterwards from the Admin app.
 */
export {
  checkout,
  resumePayment,
  acceptBooking,
  rejectBooking,
  cancelBookingByCustomer,
  startWork,
  confirmWithCode,
  raiseDispute,
  BookingsError,
  type CheckoutInput,
  type CheckoutResult,
} from "./service.js";

export { listMyOrders, getMyOrder, getOrderAsAdmin, setPasswordForBookingCustomer } from "./queries.js";
export { listOffers, sendOffer, acceptOffer, acceptOfferAsAdmin, sendOfferAsAdmin } from "./offers.js";
export { TRANSITIONS, canTransition, assertTransition, checkpointsFor, codeCountFor, type StageCheckpoint } from "./state.js";

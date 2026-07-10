/**
 * Rider — the Rider App's server logic. PRD Section 15.
 *
 * Owns: riders, rider_documents, rider_reliability, rider_wallets,
 * rider_assignments.
 *
 * A rider is only ever assigned to a physical-goods booking — the database
 * refuses a rider on a service booking (reject_rider_on_service_booking, 0007).
 * Assignment reads riders.vehicle_type so a bulk order never goes to a bike
 * (pick_delivery_rider, 0021).
 *
 * The delivery/return actions live here but call @/modules/bookings and
 * @/modules/payments for anything that moves money — this module never touches
 * a payment processor, and a delivery completes only on the customer's code.
 */
export { RiderError, currentRider, requireApprovedRider } from "./context";
export { registerRider, submitDocument } from "./registration";
export { listQueue, getAssignment } from "./queue";
export {
  callRider,
  acceptAssignment,
  declineAssignment,
  markPickedUp,
  markEnRoute,
  markArrived,
  confirmDelivery,
  confirmReturn,
} from "./delivery";
export { getEarnings, updateRiderBank } from "./earnings";

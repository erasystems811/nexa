/**
 * Bookings — the lifecycle state machine. PRD Sections 07, 09, 10.
 *
 * Owns: bookings, booking_confirmation_codes, event_projects,
 * event_project_checklist_items.
 *
 * Calls `modules/payments` for every movement of money, and never a payment
 * processor. It does not know Flutterwave exists.
 *
 * The rule the state machine exists to enforce: a stage advances when the
 * customer's confirmation code is entered, never when a provider or rider taps
 * "done".
 * Phase 1: empty.
 */
export {};

import type { BookingStatus, FulfillmentType } from "@/lib/db/types";

/**
 * The booking lifecycle. PRD Section 09.
 *
 * One deviation from the PRD's table, and it is deliberate. Section 09 lists
 * Accepted above Paid/Held, but it also says a Rejected booking is "refunded
 * automatically" — you cannot refund money you never took. And Section 14 says
 * the confirmation code is "front and centre on the order once payment is made,"
 * which is before any provider has responded.
 *
 * So money is held at checkout, and the provider accepts or rejects a booking
 * that is already paid for:
 *
 *   pending ─pay─> paid_held ─provider accepts─> accepted ─stage 1─> in_progress
 *                     │                              │                    │
 *                     │                       stage 2 code ──────────> completed
 *                     └─provider rejects─> rejected (auto full refund)
 *
 * `pending` exists only for the instant between the row and the hold.
 */
export const TRANSITIONS: Readonly<Record<BookingStatus, readonly BookingStatus[]>> = {
  pending: ["paid_held", "cancelled"],
  paid_held: ["accepted", "rejected", "cancelled", "disputed"],
  accepted: ["in_progress", "cancelled", "rejected", "disputed"],
  in_progress: ["completed", "disputed"],
  completed: ["disputed"],
  rejected: [],
  cancelled: [],
  disputed: ["completed", "cancelled"],
};

export function canTransition(from: BookingStatus, to: BookingStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

export function assertTransition(from: BookingStatus, to: BookingStatus): void {
  if (!canTransition(from, to)) {
    throw new Error(`A booking cannot go from ${from} to ${to}`);
  }
}

/**
 * What has to happen for stage 1 to release, per fulfillment type. PRD Section 10.
 *
 * Only Delivery + Return needs a customer code at stage 1, because only there is
 * the customer present at the stage-1 checkpoint (the drop-off). For the others,
 * stage 1 is an operational event with nobody to read a code out.
 */
export interface StageCheckpoint {
  stage1: string;
  stage1NeedsCode: boolean;
  stage2: string;
}

export function checkpointsFor(type: FulfillmentType): StageCheckpoint {
  switch (type) {
    case "delivery":
      return {
        stage1: "Rider picks up from the provider",
        stage1NeedsCode: false,
        stage2: "Customer's delivery code, entered on drop-off",
      };
    case "delivery_return":
      return {
        stage1: "Rider drops off — customer's code #1",
        stage1NeedsCode: true,
        stage2: "Rider collects after the event — customer's code #2",
      };
    case "onsite_service":
      return {
        stage1: "Provider checks in at the venue",
        stage1NeedsCode: false,
        stage2: "Customer's code, given at the end of service",
      };
    case "vendor_location_service":
      return {
        stage1: "Provider accepts the booking",
        stage1NeedsCode: false,
        stage2: "Customer's code, given on arrival",
      };
  }
}

/** How many codes this booking generates. Section 04. */
export function codeCountFor(type: FulfillmentType): 1 | 2 {
  return type === "delivery_return" ? 2 : 1;
}

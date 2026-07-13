import type { BookingStatus, FulfillmentType } from "@/lib/db/types";

/**
 * The booking lifecycle, on the services model (migration 0028).
 *
 *   pending      the row exists, the money has not been taken
 *   paid_held    the customer has paid 100% into Nexa's escrow
 *   accepted     the vendor said yes — and the deposit share left for their bank
 *   in_progress  optional: the vendor has started the job. Moves no money.
 *   completed    the customer gave up their confirmation code, the balance paid
 *
 * `accepted -> completed` is a legal edge because in_progress is a courtesy, not
 * a checkpoint: nothing about the money depends on a vendor having tapped
 * "started", and a booking must never be stuck unpayable because they did not.
 */
export const TRANSITIONS: Readonly<Record<BookingStatus, readonly BookingStatus[]>> = {
  pending: ["paid_held", "cancelled"],
  paid_held: ["accepted", "rejected", "cancelled", "disputed"],
  accepted: ["in_progress", "completed", "cancelled", "rejected", "disputed"],
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

export interface StageCheckpoint {
  stage1: string;
  stage1NeedsCode: boolean;
  stage2: string;
}

/**
 * What has to happen for each stage's money to move. Both service types now
 * share the same two: the vendor accepts, and the customer hands over the code.
 * The wording differs only because the customer is reading it.
 */
export function checkpointsFor(type: FulfillmentType): StageCheckpoint {
  switch (type) {
    case "onsite_service":
      return {
        stage1: "Vendor accepts the booking — deposit released",
        stage1NeedsCode: false,
        stage2: "You give the vendor your code when the job is done",
      };
    case "vendor_location_service":
      return {
        stage1: "Vendor accepts the booking — deposit released",
        stage1NeedsCode: false,
        stage2: "You give the vendor your code when the service is done",
      };
  }
}

/**
 * One code, always. The database mints exactly one (stage 2) when the money is
 * held, and it is the only thing that can complete a booking.
 */
export function codeCountFor(_type: FulfillmentType): 1 {
  return 1;
}

import type { BookingStatus, FulfillmentType } from "@/lib/db/types";

/**
 * The booking lifecycle (migration 0030).
 *
 *   pending      the row exists, the money has not been taken
 *   paid_held    the customer has paid 100% into Nexa's escrow
 *   accepted     the vendor said yes. No money moved.
 *   in_progress  optional: the vendor has started the job. No money moved.
 *   completed    the customer gave up their confirmation code. The job is done —
 *                  and an ADMIN releases the vendor's money afterwards, from the
 *                  Admin Console, in full or in part.
 *
 * No status in this machine pays anybody. The lifecycle records what HAPPENED;
 * what the vendor is paid for it is a separate, human decision, and it is not a
 * state a booking passes through.
 *
 * `accepted -> completed` is a legal edge because in_progress is a courtesy, not
 * a checkpoint: a booking must never be stuck uncompletable because a vendor did
 * not tap "started".
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
  stage2: string;
}

/**
 * "What happens next", in the customer's words, on a listing page and on their
 * order. Both service types share the same two steps: the vendor accepts, and the
 * customer hands over their code at the end. The wording differs only because one
 * vendor comes to them and the other does not.
 *
 * Neither step mentions a payout, because neither step causes one: Nexa holds the
 * money the whole way through, and pays the vendor after the job is done.
 */
export function checkpointsFor(type: FulfillmentType): StageCheckpoint {
  switch (type) {
    case "onsite_service":
      return {
        stage1: "The vendor accepts your booking — Nexa holds your money",
        stage2: "You give the vendor your code when the job is done",
      };
    case "vendor_location_service":
      return {
        stage1: "The vendor accepts your booking — Nexa holds your money",
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

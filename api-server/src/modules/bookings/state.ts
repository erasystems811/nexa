import type { BookingStatus, FulfillmentType } from "@nexa/db-types/src/types";

/**
 * The booking lifecycle (migration 0030). Ported from apps/customer's
 * modules/bookings/state.ts — unchanged. Reaching `completed` pays the
 * vendor; nothing else in this machine moves money except `disputed`, which
 * an admin resolves by hand.
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

export function codeCountFor(_type: FulfillmentType): 1 {
  return 1;
}

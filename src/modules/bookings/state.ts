import type { BookingStatus, FulfillmentType } from "@/lib/db/types";

/**
 * The booking lifecycle. Under Addendum v1.2, ordinary marketplace fulfillment
 * is vendor-owned; Plan Your Event is where Nexa can take stronger operational
 * responsibility. The lifecycle still supports held payments and confirmation
 * codes while the payment model is being simplified.
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

export interface StageCheckpoint {
  stage1: string;
  stage1NeedsCode: boolean;
  stage2: string;
}

export function checkpointsFor(type: FulfillmentType): StageCheckpoint {
  switch (type) {
    case "delivery":
      return {
        stage1: "Provider starts fulfillment",
        stage1NeedsCode: false,
        stage2: "Customer confirms delivery or completion",
      };
    case "delivery_return":
      return {
        stage1: "Provider confirms drop-off or handover",
        stage1NeedsCode: false,
        stage2: "Customer confirms return or final completion",
      };
    case "onsite_service":
      return {
        stage1: "Provider checks in at the venue",
        stage1NeedsCode: false,
        stage2: "Customer confirms completion",
      };
    case "vendor_location_service":
      return {
        stage1: "Provider accepts the booking",
        stage1NeedsCode: false,
        stage2: "Customer confirms completion",
      };
  }
}

export function codeCountFor(type: FulfillmentType): 1 | 2 {
  return type === "delivery_return" ? 2 : 1;
}
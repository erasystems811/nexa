import clsx from "clsx";
import type { BookingStatus } from "@/lib/db/types";

/** In the customer's language rather than the schema's. */
const LABEL: Record<BookingStatus, string> = {
  pending: "Awaiting payment",
  paid_held: "Paid — held by Nexa",
  accepted: "Confirmed by provider",
  rejected: "Declined — refunded",
  in_progress: "In progress",
  completed: "Completed",
  cancelled: "Cancelled",
  disputed: "Under review",
};

export function StatusPill({ status }: { status: BookingStatus }) {
  return (
    <span
      className={clsx(
        "inline-block rounded-full px-2.5 py-1 text-[11px] font-medium",
        status === "completed" && "bg-emerald-50 text-emerald-700",
        (status === "rejected" || status === "cancelled") && "bg-destructive/10 text-destructive",
        status === "disputed" && "bg-amber-50 text-amber-900",
        !["completed", "rejected", "cancelled", "disputed"].includes(status) && "bg-muted text-muted-foreground",
      )}
    >
      {LABEL[status]}
    </span>
  );
}

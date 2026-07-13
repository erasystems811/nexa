"use client";

import { useTransition, useState } from "react";
import { resolveDisputeAction } from "@/modules/admin/actions";

/**
 * A dispute is resolved or rejected, with a note that goes on the record.
 *
 * There is no damage-claim branch any more: Nexa sells services, not rented
 * goods, so nothing comes back and there is no caution fee to award from.
 */
export function DisputeActions({ disputeId }: { disputeId: string }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const resolve = (outcome: "resolved" | "rejected") => {
    const note = window.prompt("Resolution note:");
    if (note === null) return;
    start(async () => {
      setError(null);
      try {
        await resolveDisputeAction(disputeId, outcome, note);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed");
      }
    });
  };

  return (
    <div className="mt-3 flex gap-2">
      <button
        type="button"
        disabled={pending}
        onClick={() => resolve("resolved")}
        className="h-9 rounded-lg bg-[color:var(--color-ink)] px-3 text-xs font-medium text-white disabled:opacity-40"
      >
        Resolve
      </button>
      <button
        type="button"
        disabled={pending}
        onClick={() => resolve("rejected")}
        className="h-9 rounded-lg border border-[color:var(--color-line)] px-3 text-xs font-medium disabled:opacity-40"
      >
        Reject
      </button>
      {error ? <span className="text-xs text-[color:var(--color-danger)]">{error}</span> : null}
    </div>
  );
}

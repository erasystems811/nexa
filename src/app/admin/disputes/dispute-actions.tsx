"use client";

import { useTransition, useState } from "react";
import {
  payVendorInDisputeAction,
  refundCustomerInDisputeAction,
} from "@/modules/admin/actions";

/**
 * The founder's fallback, made concrete.
 *
 * You called the customer for the code. Either they eventually gave it (and the
 * vendor entered it, nothing to do here), or they refuse. If the vendor did the
 * job, pay them without a code. If they didn't, refund the customer. Either way
 * the money moves and the dispute closes.
 */
export function DisputeActions({ disputeId }: { disputeId: string }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const act = (fn: (id: string, note?: string) => Promise<void>, prompt: string) => {
    const note = window.prompt(prompt);
    if (note === null) return;
    start(async () => {
      setError(null);
      try {
        await fn(disputeId, note);
      } catch (e) {
        setError(e instanceof Error ? e.message : "That did not work");
      }
    });
  };

  return (
    <div className="mt-4 flex flex-wrap gap-2">
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          act(payVendorInDisputeAction, "Pay the vendor without a code? Add a note for the record:")
        }
        className="h-9 rounded-lg bg-[color:var(--color-ink)] px-3 text-xs font-medium text-white disabled:opacity-40"
      >
        Pay the vendor
      </button>
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          act(refundCustomerInDisputeAction, "Refund the customer? Add a note for the record:")
        }
        className="h-9 rounded-lg border border-[color:var(--color-line)] px-3 text-xs font-medium text-[color:var(--color-danger)] disabled:opacity-40"
      >
        Refund the customer
      </button>
      {error ? <span className="text-xs text-[color:var(--color-danger)]">{error}</span> : null}
    </div>
  );
}

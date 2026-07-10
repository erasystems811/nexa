"use client";

import { useActionState, useTransition, useState } from "react";
import { resolveCautionClaimAction, resolveDisputeAction, type AdminActionState } from "@/modules/admin/actions";
import { koboToNaira } from "@/lib/money";
import { Alert } from "@/components/ui";

/**
 * PRD Section 10: a damage claim is resolved by deducting a chosen amount from
 * the caution fee to compensate the provider, refunding the rest to the
 * customer — a manual Admin decision. A plain dispute is just resolved/rejected.
 */
export function DisputeActions({
  disputeId,
  bookingId,
  isDamageClaim,
  cautionKobo,
}: {
  disputeId: string;
  bookingId: string;
  isDamageClaim: boolean;
  cautionKobo: number;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [cautionState, cautionAction, cautionPending] = useActionState(resolveCautionClaimAction, {} as AdminActionState);

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

  if (isDamageClaim) {
    return (
      <form action={cautionAction} className="mt-3 flex flex-wrap items-end gap-2">
        <input type="hidden" name="dispute_id" value={disputeId} />
        <input type="hidden" name="booking_id" value={bookingId} />
        <label className="text-xs">
          Award to provider (₦, up to {koboToNaira(cautionKobo).toLocaleString()})
          <input name="claim" type="number" min="0" max={koboToNaira(cautionKobo)} step="any" required className="mt-1 block h-10 w-40 rounded-lg border border-[color:var(--color-line)] px-3 text-sm" />
        </label>
        <button type="submit" disabled={cautionPending} className="h-10 rounded-lg bg-[color:var(--color-ink)] px-4 text-sm font-medium text-white disabled:opacity-40">
          Resolve claim
        </button>
        <p className="w-full text-xs text-[color:var(--color-ink-muted)]">The remainder is refunded to the customer.</p>
        {cautionState.error ? <Alert>{cautionState.error}</Alert> : null}
        {cautionState.ok ? <Alert tone="success">Claim resolved.</Alert> : null}
      </form>
    );
  }

  return (
    <div className="mt-3 flex gap-2">
      <button type="button" disabled={pending} onClick={() => resolve("resolved")} className="h-9 rounded-lg bg-[color:var(--color-ink)] px-3 text-xs font-medium text-white disabled:opacity-40">Resolve</button>
      <button type="button" disabled={pending} onClick={() => resolve("rejected")} className="h-9 rounded-lg border border-[color:var(--color-line)] px-3 text-xs font-medium disabled:opacity-40">Reject</button>
      {error ? <span className="text-xs text-[color:var(--color-danger)]">{error}</span> : null}
    </div>
  );
}

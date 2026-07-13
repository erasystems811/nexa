"use client";

import { useActionState } from "react";
import {
  applyPenaltyAction,
  overrideStatusAction,
  refundAction,
  type AdminActionState,
} from "@/modules/admin/actions";
import { Alert, Card } from "@/components/ui";

const STATUSES = ["paid_held", "accepted", "in_progress", "completed", "cancelled", "disputed"];

/**
 * The three money/state interventions gives Admin on a booking:
 * a manual status override, a late-arrival penalty (1%/30min, 30/70 split), and
 * a refund. Each is audited server-side.
 */
export function OrderInterventions({ bookingId }: { bookingId: string }) {
  const [penaltyState, penaltyAction, penaltyPending] = useActionState(applyPenaltyAction, {} as AdminActionState);
  const [refundState, refundFn, refundPending] = useActionState(refundAction, {} as AdminActionState);
  const [statusState, statusFn, statusPending] = useActionState(overrideStatusAction, {} as AdminActionState);

  return (
    <Card className="mt-3">
      <h2 className="text-sm font-semibold">Interventions</h2>

      <form action={penaltyAction} className="mt-3 flex flex-wrap items-end gap-2 border-b border-[color:var(--color-line)] pb-4">
        <input type="hidden" name="booking_id" value={bookingId} />
        <label className="text-xs">
          Late penalty — minutes late
          <input name="late_minutes" type="number" min="0" required className="mt-1 block h-10 w-32 rounded-lg border border-[color:var(--color-line)] px-3 text-sm" />
        </label>
        <button type="submit" disabled={penaltyPending} className="h-10 rounded-lg border border-[color:var(--color-line)] px-4 text-sm font-medium disabled:opacity-40">Apply penalty</button>
        {penaltyState.error ? <Alert>{penaltyState.error}</Alert> : null}
        {penaltyState.ok ? <Alert tone="success">Penalty applied (30% to customer, 70% retained).</Alert> : null}
      </form>

      <form action={refundFn} className="mt-3 flex flex-wrap items-end gap-2 border-b border-[color:var(--color-line)] pb-4">
        <input type="hidden" name="booking_id" value={bookingId} />
        <label className="text-xs">
          Refund — amount (₦)
          <input name="amount" type="number" min="0" step="any" required className="mt-1 block h-10 w-32 rounded-lg border border-[color:var(--color-line)] px-3 text-sm" />
        </label>
        <input name="reason" placeholder="Reason" required className="h-10 flex-1 rounded-lg border border-[color:var(--color-line)] px-3 text-sm" />
        <button type="submit" disabled={refundPending} className="h-10 rounded-lg border border-[color:var(--color-line)] px-4 text-sm font-medium disabled:opacity-40">Refund</button>
        {refundState.error ? <Alert>{refundState.error}</Alert> : null}
        {refundState.ok ? <Alert tone="success">Refunded.</Alert> : null}
      </form>

      <form action={statusFn} className="mt-3 flex flex-wrap items-end gap-2">
        <input type="hidden" name="booking_id" value={bookingId} />
        <label className="text-xs">
          Override status
          <select name="status" className="mt-1 block h-10 rounded-lg border border-[color:var(--color-line)] px-3 text-sm">
            {STATUSES.map((s) => <option key={s} value={s}>{s.replace("_", " ")}</option>)}
          </select>
        </label>
        <input name="reason" placeholder="Reason" required className="h-10 flex-1 rounded-lg border border-[color:var(--color-line)] px-3 text-sm" />
        <button type="submit" disabled={statusPending} className="h-10 rounded-lg border border-[color:var(--color-line)] px-4 text-sm font-medium disabled:opacity-40">Override</button>
        {statusState.error ? <Alert>{statusState.error}</Alert> : null}
        {statusState.ok ? <Alert tone="success">Status changed.</Alert> : null}
      </form>
      <p className="mt-2 text-xs text-[color:var(--color-ink-muted)]">
        A status override changes the booking&rsquo;s state only — it does not move money. Every action here is logged.
      </p>
    </Card>
  );
}

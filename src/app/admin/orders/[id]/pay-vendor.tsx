"use client";

import { useActionState, useState } from "react";
import {
  payVendorAction,
  refundAction,
  overrideStatusAction,
  type AdminActionState,
} from "@/modules/admin/actions";
import { Alert, Card } from "@/components/ui";
import { formatKobo, koboToNaira } from "@/lib/money";

/**
 * THE core admin job: Nexa is holding the customer's money, the job is done, and
 * a person decides how much of it the vendor gets. The amount starts at
 * everything still held and can only be lowered — the server refuses anything
 * above it, and this form will not even offer it.
 */
export function PayVendor({
  bookingId,
  stillHeldKobo,
  commissionPercent,
}: {
  bookingId: string;
  stillHeldKobo: number;
  /** Only decides what the box opens with. It is not enforced anywhere. */
  commissionPercent: number;
}) {
  const [state, action, pending] = useActionState(payVendorAction, {} as AdminActionState);
  const maxNaira = koboToNaira(stillHeldKobo);

  // The suggestion: everything Nexa holds, less its commission. Rounded to whole
  // naira so the box never opens with a number nobody would type.
  const suggestedKobo = Math.round(stillHeldKobo * (1 - commissionPercent / 100));
  const suggestedNaira = Math.floor(koboToNaira(suggestedKobo));

  const [naira, setNaira] = useState(String(suggestedNaira));

  const entered = Number(naira);
  const tooMuch = Number.isFinite(entered) && entered > maxNaira;
  const keptKobo = Number.isFinite(entered) && !tooMuch ? stillHeldKobo - Math.round(entered * 100) : 0;

  return (
    <Card className="mt-4 border-[color:var(--color-ink)]">
      <h2 className="text-base font-semibold">Pay the vendor</h2>
      <p className="mt-1 text-sm text-[color:var(--color-ink-muted)]">
        Nexa is holding <strong className="text-[color:var(--color-ink)]">{formatKobo(stillHeldKobo)}</strong> on this
        booking. Send the vendor all of it, or less — whatever you do not send, Nexa keeps.
      </p>

      {commissionPercent > 0 ? (
        <p className="mt-2 text-xs text-[color:var(--color-ink-muted)]">
          Filled in for you at your {commissionPercent}% commission, which leaves Nexa{" "}
          <strong className="text-[color:var(--color-ink)]">
            {formatKobo(stillHeldKobo - suggestedKobo)}
          </strong>
          . Change the number if this booking is different.
        </p>
      ) : null}

      <form action={action} className="mt-4 flex flex-wrap items-end gap-3">
        <input type="hidden" name="booking_id" value={bookingId} />
        <label className="text-xs font-medium">
          Amount to pay the vendor (₦)
          <input
            name="amount"
            type="number"
            min="1"
            max={maxNaira}
            step="any"
            required
            value={naira}
            onChange={(e) => setNaira(e.target.value)}
            className="mt-1 block h-12 w-48 rounded-xl border border-[color:var(--color-line)] px-4 text-base tabular-nums outline-none focus:border-[color:var(--color-ink)]"
          />
        </label>
        <button
          type="submit"
          disabled={pending || tooMuch}
          className="h-12 rounded-full bg-[color:var(--color-ink)] px-6 text-sm font-medium text-white disabled:opacity-40"
        >
          {pending ? "Sending…" : "Release to vendor"}
        </button>
      </form>

      {tooMuch ? (
        <p className="mt-2 text-xs text-[color:var(--color-danger)]">
          Nexa is only holding {formatKobo(stillHeldKobo)} on this booking. You cannot pay out more than that.
        </p>
      ) : (
        <p className="mt-2 text-xs text-[color:var(--color-ink-muted)]">
          Nexa keeps {formatKobo(keptKobo)} of what it is holding.
        </p>
      )}

      {state.error ? <div className="mt-3"><Alert>{state.error}</Alert></div> : null}
      {state.ok ? <div className="mt-3"><Alert tone="success">Sent to the vendor&rsquo;s bank account.</Alert></div> : null}
    </Card>
  );
}

/** Money back to the customer. Also capped at what Nexa is still holding. */
export function RefundCustomer({ bookingId, stillHeldKobo }: { bookingId: string; stillHeldKobo: number }) {
  const [state, action, pending] = useActionState(refundAction, {} as AdminActionState);

  return (
    <Card className="mt-3">
      <h2 className="text-sm font-semibold">Refund the customer</h2>
      <p className="mt-1 text-xs text-[color:var(--color-ink-muted)]">
        Sends money back from what Nexa is holding — at most {formatKobo(stillHeldKobo)}.
      </p>
      <form action={action} className="mt-3 flex flex-wrap items-end gap-2">
        <input type="hidden" name="booking_id" value={bookingId} />
        <label className="text-xs">
          Amount (₦)
          <input
            name="amount"
            type="number"
            min="1"
            max={koboToNaira(stillHeldKobo)}
            step="any"
            required
            className="mt-1 block h-10 w-32 rounded-lg border border-[color:var(--color-line)] px-3 text-sm tabular-nums"
          />
        </label>
        <input
          name="reason"
          placeholder="Why?"
          required
          className="h-10 flex-1 rounded-lg border border-[color:var(--color-line)] px-3 text-sm"
        />
        <button
          type="submit"
          disabled={pending}
          className="h-10 rounded-lg border border-[color:var(--color-line)] px-4 text-sm font-medium disabled:opacity-40"
        >
          {pending ? "Refunding…" : "Refund"}
        </button>
      </form>
      {state.error ? <div className="mt-2"><Alert>{state.error}</Alert></div> : null}
      {state.ok ? <div className="mt-2"><Alert tone="success">Sent back to the customer.</Alert></div> : null}
    </Card>
  );
}

const STATUSES = ["paid_held", "accepted", "in_progress", "completed", "cancelled", "disputed"];

/** A blunt instrument, kept out of the way. It moves no money. */
export function ChangeStatus({ bookingId }: { bookingId: string }) {
  const [state, action, pending] = useActionState(overrideStatusAction, {} as AdminActionState);

  return (
    <Card className="mt-3">
      <h2 className="text-sm font-semibold">Change the booking status by hand</h2>
      <p className="mt-1 text-xs text-[color:var(--color-ink-muted)]">
        Only use this when something went wrong. It changes the booking, not the money.
      </p>
      <form action={action} className="mt-3 flex flex-wrap items-end gap-2">
        <input type="hidden" name="booking_id" value={bookingId} />
        <select name="status" className="h-10 rounded-lg border border-[color:var(--color-line)] px-3 text-sm">
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s.replace(/_/g, " ")}
            </option>
          ))}
        </select>
        <input
          name="reason"
          placeholder="Why?"
          required
          className="h-10 flex-1 rounded-lg border border-[color:var(--color-line)] px-3 text-sm"
        />
        <button
          type="submit"
          disabled={pending}
          className="h-10 rounded-lg border border-[color:var(--color-line)] px-4 text-sm font-medium disabled:opacity-40"
        >
          {pending ? "Changing…" : "Change"}
        </button>
      </form>
      {state.error ? <div className="mt-2"><Alert>{state.error}</Alert></div> : null}
      {state.ok ? <div className="mt-2"><Alert tone="success">Changed.</Alert></div> : null}
    </Card>
  );
}

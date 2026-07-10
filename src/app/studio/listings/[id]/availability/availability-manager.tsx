"use client";

import { useActionState, useTransition } from "react";
import { blockAction, removeBlockAction } from "@/modules/provider/actions";
import type { FormState } from "@/modules/provider/actions";
import { Card } from "@/components/ui";

interface Block {
  id: string;
  starts_at: string;
  ends_at: string;
  note: string | null;
}

/**
 * "Booked" is derived from live bookings and shown read-only — the provider
 * cannot un-book a paid slot from here. Only "Unavailable" blocks are theirs to
 * add and remove. PRD Section 13.
 */
export function AvailabilityManager({
  listingId,
  blocks,
  booked,
}: {
  listingId: string;
  blocks: Block[];
  booked: Array<{ start: string; end: string | null }>;
}) {
  const [state, action, pending] = useActionState(blockAction, {} as FormState);
  const [removing, startRemove] = useTransition();

  return (
    <div className="space-y-4">
      <Card>
        <h2 className="mb-3 text-sm font-semibold">Block a date as unavailable</h2>
        <form action={action} className="flex flex-wrap items-end gap-2">
          <input type="hidden" name="listing_id" value={listingId} />
          <label className="flex-1">
            <span className="mb-1 block text-xs text-[color:var(--color-ink-muted)]">Date</span>
            <input
              name="date"
              type="date"
              required
              className="h-10 w-full rounded-lg border border-[color:var(--color-line)] px-3 text-sm"
            />
          </label>
          <button
            type="submit"
            disabled={pending}
            className="h-10 rounded-lg bg-[color:var(--color-ink)] px-4 text-sm font-medium text-white disabled:opacity-40"
          >
            Block
          </button>
        </form>
        {state.error ? (
          <p className="mt-2 text-xs text-[color:var(--color-danger)]">{state.error}</p>
        ) : null}
      </Card>

      {booked.length > 0 ? (
        <Card>
          <h2 className="mb-2 text-sm font-semibold">Booked</h2>
          <ul className="space-y-1 text-sm">
            {booked.map((b, i) => (
              <li key={i} className="text-[color:var(--color-ink-muted)]">
                {new Date(b.start).toLocaleDateString("en-NG")} — booked
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      {blocks.length > 0 ? (
        <Card>
          <h2 className="mb-2 text-sm font-semibold">Unavailable</h2>
          <ul className="space-y-2 text-sm">
            {blocks.map((b) => (
              <li key={b.id} className="flex items-center justify-between">
                <span>{new Date(b.starts_at).toLocaleDateString("en-NG")}</span>
                <button
                  type="button"
                  disabled={removing}
                  onClick={() => startRemove(() => removeBlockAction(b.id, listingId))}
                  className="text-xs text-[color:var(--color-danger)] disabled:opacity-40"
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
    </div>
  );
}

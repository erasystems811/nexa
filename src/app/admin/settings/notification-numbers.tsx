"use client";

import { useActionState, useTransition, useState } from "react";
import {
  addNotificationNumberAction,
  removeNotificationNumberAction,
  type AdminActionState,
} from "@/modules/admin/actions";

const initialState: AdminActionState = {};

/**
 * Every number listed here gets pinged on WhatsApp the moment a customer
 * types "help" - whoever's on the list checks the request in Support and
 * assigns it, same as a request that came in through the website form.
 */
export function NotificationNumbers({
  numbers,
}: {
  numbers: { id: string; phone: string; label: string | null }[];
}) {
  const [state, formAction, pending] = useActionState(addNotificationNumberAction, initialState);
  const [removing, startRemove] = useTransition();
  const [removeError, setRemoveError] = useState<string | null>(null);

  const remove = (id: string) => {
    startRemove(async () => {
      setRemoveError(null);
      try {
        await removeNotificationNumberAction(id);
      } catch (e) {
        setRemoveError(e instanceof Error ? e.message : "Could not remove that number");
      }
    });
  };

  return (
    <div>
      <ul className="divide-y divide-[color:var(--color-line)]">
        {numbers.map((n) => (
          <li key={n.id} className="flex items-center justify-between gap-4 py-3">
            <div>
              <p className="text-sm font-medium">{n.phone}</p>
              {n.label ? (
                <p className="text-xs text-[color:var(--color-ink-muted)]">{n.label}</p>
              ) : null}
            </div>
            <button
              type="button"
              disabled={removing}
              onClick={() => remove(n.id)}
              className="text-xs font-medium text-[color:var(--color-danger)] disabled:opacity-40"
            >
              Remove
            </button>
          </li>
        ))}
        {numbers.length === 0 ? (
          <li className="py-3 text-sm text-[color:var(--color-ink-muted)]">No numbers added yet.</li>
        ) : null}
      </ul>
      {removeError ? (
        <p className="mt-2 text-xs text-[color:var(--color-danger)]">{removeError}</p>
      ) : null}

      <form action={formAction} className="mt-4 flex flex-wrap items-end gap-2">
        <div>
          <label className="mb-1 block text-xs font-medium text-[color:var(--color-ink-muted)]">
            WhatsApp number
          </label>
          <input
            name="phone"
            placeholder="2348012345678"
            className="h-9 w-40 rounded-lg border border-[color:var(--color-line)] px-2 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-[color:var(--color-ink-muted)]">
            Label (optional)
          </label>
          <input
            name="label"
            placeholder="e.g. Chidera"
            className="h-9 w-40 rounded-lg border border-[color:var(--color-line)] px-2 text-sm"
          />
        </div>
        <button
          type="submit"
          disabled={pending}
          className="h-9 rounded-lg bg-[color:var(--color-ink)] px-3 text-xs font-medium text-white disabled:opacity-40"
        >
          Add
        </button>
      </form>
      {state.error ? (
        <p className="mt-2 text-xs text-[color:var(--color-danger)]">{state.error}</p>
      ) : null}
    </div>
  );
}

"use client";

import { useActionState, useTransition, useState } from "react";
import {
  addNotificationNumberAction,
  removeNotificationNumberAction,
  type AdminActionState,
} from "@/modules/admin/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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
      <ul className="divide-y divide-border">
        {numbers.map((n) => (
          <li key={n.id} className="flex items-center justify-between gap-4 py-3">
            <div>
              <p className="text-sm font-medium text-foreground">{n.phone}</p>
              {n.label ? <p className="text-xs text-muted-foreground">{n.label}</p> : null}
            </div>
            <button
              type="button"
              disabled={removing}
              onClick={() => remove(n.id)}
              className="text-xs font-medium text-destructive disabled:opacity-40"
            >
              Remove
            </button>
          </li>
        ))}
        {numbers.length === 0 ? (
          <li className="py-3 text-sm text-muted-foreground">No numbers added yet.</li>
        ) : null}
      </ul>
      {removeError ? <p className="mt-2 text-xs text-destructive">{removeError}</p> : null}

      <form action={formAction} className="mt-4 flex flex-wrap items-end gap-2">
        <div>
          <Label className="mb-1 block text-xs font-medium text-muted-foreground">WhatsApp number</Label>
          <Input name="phone" placeholder="2348012345678" className="h-9 w-40" />
        </div>
        <div>
          <Label className="mb-1 block text-xs font-medium text-muted-foreground">Label (optional)</Label>
          <Input name="label" placeholder="e.g. Chidera" className="h-9 w-40" />
        </div>
        <Button type="submit" size="sm" disabled={pending}>
          Add
        </Button>
      </form>
      {state.error ? <p className="mt-2 text-xs text-destructive">{state.error}</p> : null}
    </div>
  );
}

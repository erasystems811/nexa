"use client";

import { useActionState, useState } from "react";
import { addProviderAction, type AdminActionState } from "@/modules/admin/actions";
import { Alert } from "@/components/ui";

/** Add a vendor by hand. */
export function AddProvider() {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(addProviderAction, {} as AdminActionState);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="h-10 rounded-full bg-[color:var(--color-ink)] px-5 text-sm font-medium text-white"
      >
        Add a vendor
      </button>
    );
  }

  return (
    <form action={action} className="rounded-[var(--radius-card)] border border-[color:var(--color-line)] bg-white p-4">
      <h2 className="text-sm font-semibold">Add a vendor</h2>
      <p className="mt-1 text-xs text-[color:var(--color-ink-muted)]">
        Creates their account and approves them straight away. They get an email with a code to set their
        own password.
      </p>
      <div className="mt-3 space-y-2">
        <input name="email" type="email" placeholder="Email" required className="h-11 w-full rounded-lg border border-[color:var(--color-line)] px-3 text-sm" />
        <input name="business_name" placeholder="Business name" required className="h-11 w-full rounded-lg border border-[color:var(--color-line)] px-3 text-sm" />
      </div>
      {state.error ? <div className="mt-2"><Alert>{state.error}</Alert></div> : null}
      {state.ok ? (
        <div className="mt-2 space-y-2">
          <Alert tone="success">
            {state.warning ? "Vendor added." : "Vendor added. A set-password email is on its way to them."}
          </Alert>
          {state.warning ? <Alert>{state.warning}</Alert> : null}
        </div>
      ) : null}
      <div className="mt-3 flex gap-2">
        <button type="submit" disabled={pending} className="h-10 rounded-full bg-[color:var(--color-ink)] px-5 text-sm font-medium text-white disabled:opacity-40">
          {pending ? "Adding…" : "Add vendor"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="h-10 rounded-full border border-[color:var(--color-line)] px-5 text-sm">
          Cancel
        </button>
      </div>
    </form>
  );
}

"use client";

import { useActionState, useState } from "react";
import { inviteStaffAction, type AdminActionState } from "@/modules/admin/actions";
import { STAFF_ROLES, STAFF_ROLE_LABELS } from "@/modules/admin/permissions";
import { Alert } from "@/components/ui";

export function InviteStaff() {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(inviteStaffAction, {} as AdminActionState);

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="h-10 rounded-full bg-[color:var(--color-ink)] px-5 text-sm font-medium text-white">
        Add a staff member
      </button>
    );
  }

  return (
    <form action={action} className="rounded-[var(--radius-card)] border border-[color:var(--color-line)] bg-[color:var(--color-surface)] p-4">
      <h2 className="text-sm font-semibold">Add a staff member</h2>
      <p className="mt-1 text-xs text-[color:var(--color-ink-muted)]">
        Creates their own login and starts them on the chosen role&rsquo;s views. You can grant extra views after. They
        are emailed a code to set their own password.
      </p>
      <div className="mt-3 space-y-2">
        <input name="full_name" placeholder="Full name" required className="h-11 w-full rounded-lg border border-[color:var(--color-line)] px-3 text-sm" />
        <input name="email" type="email" placeholder="Work email" required className="h-11 w-full rounded-lg border border-[color:var(--color-line)] px-3 text-sm" />
        <input name="department" placeholder="Department (optional)" className="h-11 w-full rounded-lg border border-[color:var(--color-line)] px-3 text-sm" />
        <select name="role" required className="h-11 w-full rounded-lg border border-[color:var(--color-line)] px-3 text-sm">
          {STAFF_ROLES.map((r) => (
            <option key={r} value={r}>{STAFF_ROLE_LABELS[r]}</option>
          ))}
        </select>
      </div>
      {state.error ? <div className="mt-2"><Alert>{state.error}</Alert></div> : null}
      {state.ok ? (
        <div className="mt-2 space-y-2">
          <Alert tone="success">
            {state.warning ? "Staff member added." : "Staff member added. A set-password email is on its way to them."}
          </Alert>
          {state.warning ? <Alert>{state.warning}</Alert> : null}
        </div>
      ) : null}
      <div className="mt-3 flex gap-2">
        <button type="submit" disabled={pending} className="h-10 rounded-full bg-[color:var(--color-ink)] px-5 text-sm font-medium text-white disabled:opacity-40">
          {pending ? "Adding…" : "Add staff"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="h-10 rounded-full border border-[color:var(--color-line)] px-5 text-sm">Cancel</button>
      </div>
    </form>
  );
}

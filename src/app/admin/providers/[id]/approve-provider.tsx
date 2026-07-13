"use client";

import { useActionState, useState } from "react";
import { approveProviderAction, type AdminActionState } from "@/modules/admin/actions";
import { Alert } from "@/components/ui";

/**
 * Approve with terms.: the deposit % (and any override) is set
 * here, by Admin, on the agreement — the only place these are ever written.
 */
export function ApproveProvider({ providerId }: { providerId: string }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(approveProviderAction, {} as AdminActionState);

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="h-9 rounded-lg bg-[color:var(--color-ink)] px-4 text-xs font-medium text-white">
        Approve & set terms
      </button>
    );
  }

  return (
    <form action={action} className="w-full rounded-[var(--radius-card)] border border-[color:var(--color-line)] bg-white p-4">
      <input type="hidden" name="provider_id" value={providerId} />
      <h2 className="text-sm font-semibold">Approve provider</h2>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <label className="text-xs">
          Deposit % (required)
          <input name="deposit_percent" type="number" min="0" max="100" step="any" required className="mt-1 h-10 w-full rounded-lg border border-[color:var(--color-line)] px-3 text-sm" />
        </label>
        <label className="text-xs">
          Commission override % (optional)
          <input name="commission_override" type="number" min="0" max="100" step="any" className="mt-1 h-10 w-full rounded-lg border border-[color:var(--color-line)] px-3 text-sm" />
        </label>
        <label className="text-xs">
          Stage-1 release override % (optional)
          <input name="stage1_override" type="number" min="0" max="100" step="any" className="mt-1 h-10 w-full rounded-lg border border-[color:var(--color-line)] px-3 text-sm" />
        </label>
        <label className="text-xs">
          Late-penalty override %/30min (optional)
          <input name="late_penalty_override" type="number" min="0" max="100" step="any" className="mt-1 h-10 w-full rounded-lg border border-[color:var(--color-line)] px-3 text-sm" />
        </label>
      </div>
      {state.error ? <div className="mt-2"><Alert>{state.error}</Alert></div> : null}
      <div className="mt-3 flex gap-2">
        <button type="submit" disabled={pending} className="h-10 rounded-full bg-[color:var(--color-ink)] px-5 text-sm font-medium text-white disabled:opacity-40">
          {pending ? "Approving…" : "Approve"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="h-10 rounded-full border border-[color:var(--color-line)] px-5 text-sm">
          Cancel
        </button>
      </div>
    </form>
  );
}

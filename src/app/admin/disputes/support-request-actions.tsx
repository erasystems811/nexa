"use client";

import { useTransition, useState } from "react";
import {
  assignSupportRequestAction,
  resolveSupportRequestAction,
} from "@/modules/admin/actions";

export function SupportRequestActions({
  requestId,
  staff,
}: {
  requestId: string;
  staff: { id: string; name: string }[];
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const assign = (assigneeId: string) => {
    if (!assigneeId) return;
    start(async () => {
      setError(null);
      try {
        await assignSupportRequestAction(requestId, assigneeId);
      } catch (e) {
        setError(e instanceof Error ? e.message : "That did not work");
      }
    });
  };

  const resolve = () => {
    start(async () => {
      setError(null);
      try {
        await resolveSupportRequestAction(requestId);
      } catch (e) {
        setError(e instanceof Error ? e.message : "That did not work");
      }
    });
  };

  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      <select
        disabled={pending}
        defaultValue=""
        onChange={(e) => assign(e.target.value)}
        className="h-9 rounded-lg border border-[color:var(--color-line)] bg-white px-2 text-xs"
      >
        <option value="" disabled>
          Assign to…
        </option>
        {staff.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </select>
      <button
        type="button"
        disabled={pending}
        onClick={resolve}
        className="h-9 rounded-lg bg-[color:var(--color-ink)] px-3 text-xs font-medium text-white disabled:opacity-40"
      >
        Mark resolved
      </button>
      {error ? <span className="text-xs text-[color:var(--color-danger)]">{error}</span> : null}
    </div>
  );
}

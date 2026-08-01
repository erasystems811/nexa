"use client";

import { useTransition, useState } from "react";
import { assignSupportRequestAction, resolveSupportRequestAction } from "@/modules/admin/actions";
import { Button } from "@/components/ui/button";

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
        className="h-9 rounded-md border border-input bg-transparent px-2 text-xs outline-none focus-visible:ring-1 focus-visible:ring-ring"
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
      <Button size="sm" disabled={pending} onClick={resolve}>
        Mark resolved
      </Button>
      {error ? <span className="text-xs text-destructive">{error}</span> : null}
    </div>
  );
}

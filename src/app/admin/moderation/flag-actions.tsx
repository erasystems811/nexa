"use client";

import { useTransition } from "react";
import { resolveFlagAction } from "@/modules/messaging/actions";

export function FlagActions({ flagId }: { flagId: string }) {
  const [pending, startTransition] = useTransition();

  const resolve = (decision: "confirmed" | "dismissed") =>
    startTransition(async () => {
      await resolveFlagAction(flagId, decision);
    });

  return (
    <div className="mt-4 flex gap-2">
      <button
        type="button"
        disabled={pending}
        onClick={() => resolve("confirmed")}
        className="h-10 rounded-lg bg-[color:var(--color-ink)] px-4 text-sm font-medium text-white disabled:opacity-40"
      >
        Confirm breach
      </button>
      <button
        type="button"
        disabled={pending}
        onClick={() => resolve("dismissed")}
        className="h-10 rounded-lg border border-[color:var(--color-line)] px-4 text-sm font-medium disabled:opacity-40"
      >
        False positive
      </button>
    </div>
  );
}

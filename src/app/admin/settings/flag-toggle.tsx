"use client";

import { useActionState } from "react";
import { toggleFlagAction, type ActionState } from "./actions";
import type { FeatureFlag } from "@/lib/db/types";

const initialState: ActionState = {};

export function FlagToggle({ flag }: { flag: FeatureFlag }) {
  const [state, formAction, pending] = useActionState(toggleFlagAction, initialState);

  return (
    <div className="flex items-start justify-between gap-4 px-6 py-4">
      <div className="min-w-0">
        <p className="text-sm font-medium text-foreground">{flag.label}</p>
        <p className="mt-0.5 font-mono text-xs text-muted-foreground">{flag.key}</p>
        {flag.description ? (
          <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{flag.description}</p>
        ) : null}
        {state.error ? <p className="mt-1.5 text-xs text-destructive">{state.error}</p> : null}
      </div>

      <form action={formAction} className="shrink-0">
        <input type="hidden" name="key" value={flag.key} />
        <input type="hidden" name="enabled" value={String(!flag.enabled)} />
        <button
          type="submit"
          disabled={pending || flag.is_locked}
          aria-pressed={flag.enabled}
          aria-label={`${flag.enabled ? "Disable" : "Enable"} ${flag.label}`}
          className={[
            "relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-40",
            flag.enabled ? "bg-primary" : "bg-input",
          ].join(" ")}
        >
          <span
            className={[
              "absolute top-1 h-4 w-4 rounded-full bg-background shadow-sm transition-transform",
              flag.enabled ? "translate-x-6" : "translate-x-1",
            ].join(" ")}
          />
        </button>
      </form>
    </div>
  );
}

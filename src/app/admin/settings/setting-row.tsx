"use client";

import { useActionState } from "react";
import { updateSettingAction, type ActionState } from "./actions";
import { formatKobo } from "@/lib/money";
import type { PlatformSetting } from "@/lib/db/types";

const initialState: ActionState = {};

function preview(setting: PlatformSetting): string | null {
  const n = Number(setting.value);
  if (!Number.isFinite(n)) return null;
  if (setting.value_type === "percent") return `${n}%`;
  if (setting.value_type === "money_kobo") return formatKobo(n);
  return null;
}

export function SettingRow({ setting }: { setting: PlatformSetting }) {
  const [state, formAction, pending] = useActionState(updateSettingAction, initialState);
  const shown = preview(setting);

  return (
    <div className="border-b border-[color:var(--color-line)] py-4 last:border-0">
      <div className="flex items-baseline justify-between gap-4">
        <p className="text-sm font-medium">{setting.label}</p>
        {shown ? (
          <p className="shrink-0 text-sm tabular-nums text-[color:var(--color-ink-muted)]">
            {shown}
          </p>
        ) : null}
      </div>

      <p className="mt-0.5 font-mono text-xs text-[color:var(--color-ink-muted)]">
        {setting.key}
      </p>
      {setting.description ? (
        <p className="mt-1.5 text-xs leading-relaxed text-[color:var(--color-ink-muted)]">
          {setting.description}
        </p>
      ) : null}

      <form action={formAction} className="mt-3 flex gap-2">
        <input type="hidden" name="key" value={setting.key} />
        <input
          name="value"
          type="number"
          step="any"
          defaultValue={String(setting.value)}
          min={setting.min_value ?? undefined}
          max={setting.max_value ?? undefined}
          className="h-10 w-40 rounded-lg border border-[color:var(--color-line)] px-3 text-sm tabular-nums outline-none focus:border-[color:var(--color-ink)]"
        />
        <button
          type="submit"
          disabled={pending}
          className="h-10 rounded-lg border border-[color:var(--color-line)] px-4 text-sm font-medium disabled:opacity-40"
        >
          {pending ? "Saving…" : "Save"}
        </button>
      </form>

      {state.error ? (
        <p className="mt-1.5 text-xs text-[color:var(--color-danger)]">{state.error}</p>
      ) : null}
      {state.message ? (
        <p className="mt-1.5 text-xs text-[color:var(--color-success)]">{state.message}</p>
      ) : null}
    </div>
  );
}

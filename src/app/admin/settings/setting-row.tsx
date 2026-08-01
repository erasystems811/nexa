"use client";

import { useActionState, useState } from "react";
import { updateSettingAction, type ActionState } from "./actions";
import { formatKobo } from "@/lib/money";
import type { PlatformSetting } from "@/lib/db/types";
import { Button } from "@/components/ui/button";

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

  // Money is stored in kobo (500000 = ₦5,000), but a person thinks in Naira. The
  // box shows and accepts Naira; a hidden field carries the kobo the server
  // actually stores, so nothing downstream has to change.
  const isMoney = setting.value_type === "money_kobo";
  const [naira, setNaira] = useState(() =>
    isMoney ? String(Number(setting.value) / 100) : String(setting.value),
  );

  return (
    <div className="px-6 py-4">
      <div className="flex items-baseline justify-between gap-4">
        <p className="text-sm font-medium text-foreground">{setting.label}</p>
        {shown ? <p className="shrink-0 text-sm tabular-nums text-muted-foreground">{shown}</p> : null}
      </div>

      <p className="mt-0.5 font-mono text-xs text-muted-foreground">{setting.key}</p>
      {setting.description ? (
        <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{setting.description}</p>
      ) : null}

      <form action={formAction} className="mt-3 flex items-stretch gap-2">
        <input type="hidden" name="key" value={setting.key} />

        {isMoney ? (
          <>
            {/* What the server stores: kobo. Naira × 100, rounded so no fraction
                of a kobo slips through. */}
            <input type="hidden" name="value" value={Math.round(Number(naira || 0) * 100)} />
            <div className="flex h-9 w-40 items-center rounded-md border border-input bg-transparent px-3 shadow-sm focus-within:ring-1 focus-within:ring-ring">
              <span className="mr-1 text-sm text-muted-foreground">₦</span>
              <input
                type="number"
                step="1"
                inputMode="numeric"
                value={naira}
                onChange={(e) => setNaira(e.target.value)}
                min={setting.min_value != null ? setting.min_value / 100 : undefined}
                max={setting.max_value != null ? setting.max_value / 100 : undefined}
                className="w-full bg-transparent text-sm tabular-nums outline-none"
              />
            </div>
          </>
        ) : (
          <input
            name="value"
            type="number"
            step="any"
            defaultValue={String(setting.value)}
            min={setting.min_value ?? undefined}
            max={setting.max_value ?? undefined}
            className="h-9 w-40 rounded-md border border-input bg-transparent px-3 text-sm tabular-nums shadow-sm outline-none focus:ring-1 focus:ring-ring"
          />
        )}

        <Button type="submit" variant="outline" size="sm" disabled={pending}>
          {pending ? "Saving…" : "Save"}
        </Button>
      </form>

      {state.error ? <p className="mt-1.5 text-xs text-destructive">{state.error}</p> : null}
      {state.message ? <p className="mt-1.5 text-xs text-green-500">{state.message}</p> : null}
    </div>
  );
}

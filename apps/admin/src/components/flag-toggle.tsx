import { useState } from "react";
import type { FeatureFlag } from "@nexa/db-types";
import { apiSend } from "../lib/api";

export function FlagToggle({ flag, onChanged }: { flag: FeatureFlag; onChanged: () => void }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggle() {
    setPending(true);
    setError(null);
    try {
      await apiSend("PATCH", `/settings/flags/${flag.key}`, { enabled: !flag.enabled });
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not update the flag");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex items-start justify-between gap-4 px-6 py-4">
      <div className="min-w-0">
        <p className="text-sm font-medium text-foreground">{flag.label}</p>
        <p className="mt-0.5 font-mono text-xs text-muted-foreground">{flag.key}</p>
        {flag.description ? (
          <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{flag.description}</p>
        ) : null}
        {error ? <p className="mt-1.5 text-xs text-destructive">{error}</p> : null}
      </div>

      <button
        type="button"
        onClick={toggle}
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
    </div>
  );
}

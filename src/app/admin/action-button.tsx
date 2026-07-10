"use client";

import { useState, useTransition } from "react";

/**
 * A button that runs a server action, optionally after a confirm or a prompt.
 * Keeps every admin list page from repeating the same useTransition wiring.
 */
export function ActionButton({
  label,
  run,
  confirm,
  prompt: promptText,
  variant = "ghost",
}: {
  label: string;
  run: (value?: string) => Promise<void>;
  confirm?: string;
  prompt?: string;
  variant?: "primary" | "ghost" | "danger";
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const onClick = () => {
    let value: string | undefined;
    if (promptText) {
      const v = window.prompt(promptText);
      if (v === null) return;
      value = v;
    } else if (confirm && !window.confirm(confirm)) {
      return;
    }
    start(async () => {
      setError(null);
      try {
        await run(value);
      } catch (e) {
        setError(e instanceof Error ? e.message : "That did not work");
      }
    });
  };

  const cls =
    variant === "primary"
      ? "bg-[color:var(--color-ink)] text-white"
      : variant === "danger"
        ? "border border-[color:var(--color-line)] text-[color:var(--color-danger)]"
        : "border border-[color:var(--color-line)]";

  return (
    <>
      <button
        type="button"
        onClick={onClick}
        disabled={pending}
        className={`h-9 rounded-lg px-3 text-xs font-medium disabled:opacity-40 ${cls}`}
      >
        {pending ? "…" : label}
      </button>
      {error ? <span className="text-xs text-[color:var(--color-danger)]">{error}</span> : null}
    </>
  );
}

import { useState, useTransition } from "react";

/**
 * A button that runs an admin API call, optionally after a confirm or a
 * prompt. Keeps every admin list page from repeating the same wiring.
 */
export function ActionButton({
  label,
  run,
  confirm,
  prompt: promptText,
  variant = "ghost",
}: {
  label: string;
  /** Return a string to show it as a non-failure warning - the action still
   * succeeded (e.g. "approved, but no email went out"), it just has a caveat
   * worth surfacing. Throw only for a genuine failure. */
  run: (value?: string) => Promise<void | string>;
  confirm?: string;
  prompt?: string;
  variant?: "primary" | "ghost" | "danger";
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);

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
      setWarning(null);
      try {
        const result = await run(value);
        if (result) setWarning(result);
      } catch (e) {
        setError(e instanceof Error ? e.message : "That did not work");
      }
    });
  };

  const cls =
    variant === "primary"
      ? "bg-primary text-primary-foreground hover:bg-primary/90"
      : variant === "danger"
        ? "border border-input text-destructive hover:bg-destructive/10"
        : "border border-input hover:bg-accent hover:text-accent-foreground";

  return (
    <>
      <button
        type="button"
        onClick={onClick}
        disabled={pending}
        className={`h-9 rounded-md px-3 text-xs font-medium transition-[opacity,transform,background-color] duration-150 active:scale-[0.96] disabled:opacity-40 disabled:active:scale-100 ${cls}`}
      >
        {pending ? "…" : label}
      </button>
      {error ? <span className="text-xs text-destructive">{error}</span> : null}
      {warning ? <span className="text-xs text-amber-600">{warning}</span> : null}
    </>
  );
}

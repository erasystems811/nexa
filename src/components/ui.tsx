import clsx, { type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type { ComponentPropsWithoutRef, ReactNode } from "react";

/**
 * Merge classes so a caller can actually override a component's defaults.
 *
 * clsx only concatenates, which means `Card` shipping `bg-white` and a caller
 * passing `bg-[color:var(--color-ink)]` both end up in the class list — and which
 * one wins is decided by the order Tailwind happened to emit them in the
 * stylesheet, not by the caller's intent. That is how the Admin dashboard ended
 * up rendering white text on a white card: the dark background lost, the white
 * text did not, and the numbers vanished.
 *
 * twMerge resolves the conflict the way anyone would expect: last one wins.
 */
function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}


export function Card({
  children,
  className,
  hover,
}: {
  children: ReactNode;
  className?: string;
  /** A card that is also a link/button target lifts on hover, consistently. */
  hover?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-[var(--radius-card)] border border-[color:var(--color-line)] bg-white p-5",
        hover &&
          "transition duration-200 hover:-translate-y-0.5 hover:border-[color:var(--color-accent)]/30 hover:shadow-card-hover",
        className,
      )}
    >
      {children}
    </div>
  );
}

/** A small pill for a status, category, or trust signal — one shape used everywhere. */
export function Badge({
  children,
  tone = "neutral",
  className,
}: {
  children: ReactNode;
  tone?: "neutral" | "accent" | "success" | "warning";
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium",
        tone === "neutral" && "bg-[color:var(--color-surface-sunk)] text-[color:var(--color-ink-muted)]",
        tone === "accent" && "bg-[color:var(--color-accent-soft)] text-[color:var(--color-accent)]",
        tone === "success" && "bg-emerald-50 text-[color:var(--color-success)]",
        tone === "warning" && "bg-amber-50 text-amber-900",
        className,
      )}
    >
      {children}
    </span>
  );
}

export function Button({
  className,
  variant = "primary",
  ...props
}: ComponentPropsWithoutRef<"button"> & { variant?: "primary" | "ghost" | "danger" }) {
  return (
    <button
      {...props}
      className={cn(
        "inline-flex h-12 items-center justify-center rounded-full px-6 text-sm font-medium",
        // The press: a button that doesn't visibly react to being pressed reads
        // as unresponsive even when it isn't. This one small motion is most of
        // what makes an interface feel physical rather than flat.
        "transition-[opacity,transform] duration-150 active:scale-[0.97] disabled:opacity-50 disabled:active:scale-100",
        variant === "primary" &&
          "bg-[color:var(--color-accent)] text-white shadow-sm hover:opacity-90",
        variant === "ghost" &&
          "border border-[color:var(--color-line)] bg-white hover:bg-[color:var(--color-surface-sunk)]",
        variant === "danger" &&
          "border border-[color:var(--color-danger)]/20 bg-white text-[color:var(--color-danger)] hover:bg-red-50",
        className,
      )}
    />
  );
}

export function Field({
  label,
  hint,
  ...props
}: ComponentPropsWithoutRef<"input"> & { label: string; hint?: string }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium">{label}</span>
      <input
        {...props}
        className="h-12 w-full rounded-xl border border-[color:var(--color-line)] bg-white px-4 outline-none transition-colors focus:border-[color:var(--color-accent)]"
      />
      {hint ? (
        <span className="mt-1 block text-xs text-[color:var(--color-ink-muted)]">{hint}</span>
      ) : null}
    </label>
  );
}

export function Alert({ children, tone = "danger" }: { children: ReactNode; tone?: "danger" | "success" }) {
  return (
    <p
      role="status"
      className={cn(
        "rounded-xl px-4 py-3 text-sm",
        tone === "danger" && "bg-red-50 text-[color:var(--color-danger)]",
        tone === "success" && "bg-emerald-50 text-[color:var(--color-success)]",
      )}
    >
      {children}
    </p>
  );
}

export function PageHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <header className="mb-6">
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      {subtitle ? (
        <p className="mt-1 text-sm text-[color:var(--color-ink-muted)]">{subtitle}</p>
      ) : null}
    </header>
  );
}

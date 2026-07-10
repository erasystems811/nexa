import clsx from "clsx";
import type { ComponentPropsWithoutRef, ReactNode } from "react";

export function Card({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={clsx(
        "rounded-[var(--radius-card)] border border-[color:var(--color-line)] bg-white p-5",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function Button({
  className,
  variant = "primary",
  ...props
}: ComponentPropsWithoutRef<"button"> & { variant?: "primary" | "ghost" }) {
  return (
    <button
      {...props}
      className={clsx(
        "inline-flex h-12 items-center justify-center rounded-full px-6 text-sm font-medium",
        "transition-opacity disabled:opacity-50",
        variant === "primary" && "bg-[color:var(--color-accent)] text-white hover:opacity-90",
        variant === "ghost" &&
          "border border-[color:var(--color-line)] bg-white hover:bg-[color:var(--color-surface-sunk)]",
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
        className="h-12 w-full rounded-xl border border-[color:var(--color-line)] bg-white px-4 outline-none focus:border-[color:var(--color-ink)]"
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
      className={clsx(
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

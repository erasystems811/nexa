/** Vendor-application skeleton — a heading and a stack of form fields. */
export default function Loading() {
  return (
    <div className="mx-auto max-w-2xl px-5 py-8">
      <div className="h-8 w-1/2 animate-pulse rounded-lg bg-[color:var(--color-surface-sunk)]" />
      <div className="mt-8 space-y-5">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="space-y-2">
            <div className="h-3 w-24 animate-pulse rounded bg-[color:var(--color-surface-sunk)]" />
            <div className="h-11 w-full animate-pulse rounded-lg bg-[color:var(--color-surface-sunk)]" />
          </div>
        ))}
      </div>
    </div>
  );
}

/** Legal-page skeleton — a title and several paragraph blocks. */
export default function Loading() {
  return (
    <div className="mx-auto max-w-2xl px-5 py-12">
      <div className="h-8 w-1/2 animate-pulse rounded-lg bg-[color:var(--color-surface-sunk)]" />
      <div className="mt-8 space-y-6">
        {Array.from({ length: 5 }).map((_, s) => (
          <div key={s} className="space-y-2">
            <div className="h-4 w-1/3 animate-pulse rounded bg-[color:var(--color-surface-sunk)]" />
            <div className="h-3 w-full animate-pulse rounded bg-[color:var(--color-surface-sunk)]" />
            <div className="h-3 w-full animate-pulse rounded bg-[color:var(--color-surface-sunk)]" />
            <div className="h-3 w-2/3 animate-pulse rounded bg-[color:var(--color-surface-sunk)]" />
          </div>
        ))}
      </div>
    </div>
  );
}

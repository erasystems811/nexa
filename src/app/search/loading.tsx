/** Search skeleton — a search bar and a stack of result rows. */
export default function Loading() {
  return (
    <div className="mx-auto max-w-2xl px-5 py-8">
      <div className="h-11 w-full animate-pulse rounded-full bg-[color:var(--color-surface-sunk)]" />
      <div className="mt-6 space-y-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-24 animate-pulse rounded-2xl bg-[color:var(--color-surface-sunk)]" />
        ))}
      </div>
    </div>
  );
}

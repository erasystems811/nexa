/** Account skeleton — a heading and a few settings rows. */
export default function Loading() {
  return (
    <div className="mx-auto max-w-2xl px-5 py-8">
      <div className="h-7 w-32 animate-pulse rounded-lg bg-[color:var(--color-surface-sunk)]" />
      <div className="mt-6 space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-16 animate-pulse rounded-2xl bg-[color:var(--color-surface-sunk)]" />
        ))}
      </div>
    </div>
  );
}

/** Orders skeleton — the title, the tab pill, and a few order cards. */
export default function Loading() {
  return (
    <div className="mx-auto max-w-2xl px-5 py-8">
      <div className="h-7 w-40 animate-pulse rounded-lg bg-[color:var(--color-surface-sunk)]" />
      <div className="mt-6 h-10 w-full animate-pulse rounded-full bg-[color:var(--color-surface-sunk)]" />
      <div className="mt-6 space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-28 animate-pulse rounded-2xl bg-[color:var(--color-surface-sunk)]" />
        ))}
      </div>
    </div>
  );
}

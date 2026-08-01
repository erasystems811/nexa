/** Search skeleton — a search bar and a stack of result rows. */
export default function Loading() {
  return (
    <div>
      <div className="h-11 w-full animate-pulse rounded-full bg-muted" />
      <div className="mt-6 space-y-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-24 animate-pulse rounded-2xl bg-muted" />
        ))}
      </div>
    </div>
  );
}

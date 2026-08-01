/** Orders skeleton — the title, the tab pill, and a few order cards. */
export default function Loading() {
  return (
    <div className="space-y-8">
      <div className="h-9 w-48 animate-pulse rounded-lg bg-muted" />
      <div className="flex gap-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-9 w-28 animate-pulse rounded-md bg-muted" />
        ))}
      </div>
      <div className="space-y-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-32 animate-pulse rounded-xl bg-muted" />
        ))}
      </div>
    </div>
  );
}

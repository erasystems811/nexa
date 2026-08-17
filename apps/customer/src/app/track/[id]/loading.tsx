/** Order tracking skeleton — title, status row, and the stacked progress/payment/when cards. */
export default function Loading() {
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="space-y-2">
        <div className="h-8 w-2/3 animate-pulse rounded-md bg-muted" />
        <div className="h-4 w-1/3 animate-pulse rounded-md bg-muted" />
      </div>

      <div className="flex items-center justify-between">
        <div className="h-6 w-24 animate-pulse rounded-full bg-muted" />
        <div className="h-4 w-20 animate-pulse rounded-md bg-muted" />
      </div>

      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="h-28 animate-pulse rounded-2xl bg-muted" />
      ))}
    </div>
  );
}

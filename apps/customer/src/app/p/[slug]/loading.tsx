/** Provider profile skeleton — hero, avatar + name, listing grid, sidebar. */
export default function Loading() {
  return (
    <div className="pb-8">
      <div className="h-9 w-32 animate-pulse rounded-full bg-muted" />
      <div className="mt-3 aspect-[16/9] animate-pulse rounded-2xl bg-muted sm:aspect-[21/9]" />

      <div className="mt-5 grid gap-8 md:grid-cols-3">
        <div className="md:col-span-2">
          <div className="flex items-center gap-3">
            <div className="size-16 shrink-0 animate-pulse rounded-xl bg-muted" />
            <div className="min-w-0 flex-1 space-y-2">
              <div className="h-7 w-1/2 animate-pulse rounded-md bg-muted" />
              <div className="h-4 w-1/4 animate-pulse rounded-md bg-muted" />
            </div>
          </div>

          <div className="mt-4 flex gap-2">
            <div className="h-6 w-28 animate-pulse rounded-full bg-muted" />
            <div className="h-6 w-24 animate-pulse rounded-full bg-muted" />
          </div>

          <div className="mt-8">
            <div className="mb-3 h-6 w-40 animate-pulse rounded-md bg-muted" />
            <div className="grid gap-3 sm:grid-cols-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-[88px] animate-pulse rounded-xl bg-muted" />
              ))}
            </div>
          </div>
        </div>

        <aside className="md:col-span-1">
          <div className="h-40 animate-pulse rounded-2xl bg-muted" />
        </aside>
      </div>
    </div>
  );
}

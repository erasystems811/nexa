/** Listing page skeleton — cover photo, title, price card, action buttons. */
export default function Loading() {
  return (
    <div className="max-w-2xl pb-8">
      <div className="h-9 w-32 animate-pulse rounded-full bg-muted" />
      <div className="mt-3 aspect-[16/9] animate-pulse rounded-2xl bg-muted" />

      <div className="pt-5">
        <div className="h-8 w-3/4 animate-pulse rounded-md bg-muted" />
        <div className="mt-2 h-4 w-full animate-pulse rounded-md bg-muted" />

        <div className="mt-4 h-24 animate-pulse rounded-2xl bg-muted" />
        <div className="mt-4 h-14 animate-pulse rounded-xl bg-muted" />
        <div className="mt-4 h-32 animate-pulse rounded-2xl bg-muted" />

        <div className="mt-6 space-y-3">
          <div className="h-11 w-full animate-pulse rounded-full bg-muted" />
          <div className="h-11 w-full animate-pulse rounded-full bg-muted" />
        </div>
      </div>
    </div>
  );
}

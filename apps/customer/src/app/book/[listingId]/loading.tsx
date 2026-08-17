/** Booking/checkout skeleton — title, price summary card, form. */
export default function Loading() {
  return (
    <main className="mx-auto min-h-dvh max-w-lg px-5 py-10">
      <div className="mb-6 h-5 w-16 animate-pulse rounded-md bg-muted" />

      <div className="h-8 w-2/3 animate-pulse rounded-md bg-muted" />
      <div className="mt-2 h-4 w-1/3 animate-pulse rounded-md bg-muted" />

      <div className="mt-6 h-80 animate-pulse rounded-2xl bg-muted" />
    </main>
  );
}

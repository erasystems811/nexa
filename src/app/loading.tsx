/**
 * Instant skeleton shown the moment a navigation starts, so a tab switch feels
 * immediate instead of blank while the server renders. The persistent chrome
 * (header, bottom tab bar) stays put — only this page area swaps in.
 *
 * This is the root fallback, so it is deliberately neutral: a title line, a
 * search bar, and a grid, which reads fine on the home page and on any child
 * route that has not defined its own skeleton.
 */
export default function Loading() {
  return (
    <div className="mx-auto max-w-3xl px-5 py-10">
      <div className="h-9 w-2/3 animate-pulse rounded-lg bg-[color:var(--color-surface-sunk)]" />
      <div className="mt-6 h-11 w-full animate-pulse rounded-full bg-[color:var(--color-surface-sunk)]" />
      <div className="mt-10 grid grid-cols-2 gap-3 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-40 animate-pulse rounded-2xl bg-[color:var(--color-surface-sunk)]" />
        ))}
      </div>
    </div>
  );
}

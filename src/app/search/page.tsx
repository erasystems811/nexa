import Link from "next/link";
import type { Route } from "next";
import { searchListings } from "@/modules/search";
import { listCategories } from "@/modules/marketplace";
import { formatKobo } from "@/lib/money";
import { PageHeader } from "@/components/ui";
import { SearchBar } from "@/components/search-bar";
import { BackBar } from "@/components/back-bar";
import { CategoryIcon } from "@/components/category-icon";

/** Search & category browse.+ */
export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;

  const results = await searchListings({
    q: sp.q,
    categorySlug: sp.category,
    citySlug: sp.city,
    minPriceKobo: sp.min ? Number(sp.min) * 100 : undefined,
    maxPriceKobo: sp.max ? Number(sp.max) * 100 : undefined,
    minRating: sp.rating ? Number(sp.rating) : undefined,
    availableAt: sp.at,
  });

  const categories = await listCategories();
  const active = categories.find((c) => c.slug === sp.category);

  return (
    <main className="mx-3 my-3 max-w-3xl overflow-hidden rounded-[1.75rem] border border-[color:var(--color-line)] bg-white shadow-card px-5 py-6 sm:mx-auto sm:my-8">
      <BackBar />
      <div className="mt-3">
        <PageHeader
          title={active ? active.name : "Search"}
          subtitle={`${results.length} available ${results.length === 1 ? "listing" : "listings"}`}
        />
      </div>

      <SearchBar defaultValue={sp.q ?? ""} />

      <nav className="mt-4 -mx-5 flex gap-2 overflow-x-auto px-5 pb-1">
        <Chip href="/search" label="All" active={!sp.category} />
        {categories.map((c) => (
          <Chip key={c.id} href={`/search?category=${c.slug}` as Route} slug={c.slug} label={c.name} active={sp.category === c.slug} />
        ))}
      </nav>

      {results.length === 0 ? (
        <div className="mt-8 rounded-[var(--radius-card)] border border-dashed border-[color:var(--color-line)] p-8 text-center text-sm text-[color:var(--color-ink-muted)]">
          Nothing matches that yet. Only approved listings from verified providers appear here.
        </div>
      ) : (
        <ul className="mt-6 grid grid-cols-2 gap-4">
          {results.map((r) => (
            <li key={r.id}>
              <Link href={`/l/${r.slug}`} className="group block overflow-hidden rounded-[var(--radius-card)] border border-[color:var(--color-line)] bg-white shadow-card transition hover:shadow-card-hover">
                <div className="aspect-[4/3] overflow-hidden bg-[color:var(--color-surface-sunk)]">
                  {r.coverUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element -- external demo/provider imagery
                    <img src={r.coverUrl} alt={r.title} className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]" />
                  ) : null}
                </div>
                <div className="p-3">
                  <p className="truncate text-sm font-semibold">{r.title}</p>
                  <p className="mt-0.5 truncate text-xs text-[color:var(--color-ink-muted)]">
                    {r.providerName} · {r.categoryName}
                  </p>
                  <p className="mt-2 text-sm font-semibold text-[color:var(--color-accent)]">
                    {r.priceType === "fixed" && r.priceKobo !== null ? `from ${formatKobo(r.priceKobo)}` : "Price on request"}
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

function Chip({
  label,
  href,
  active,
  slug,
}: {
  label: string;
  href: Route;
  active: boolean;
  /** Absent on the "All" chip, which is a word rather than a category. */
  slug?: string;
}) {
  return (
    <Link
      href={href}
      className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3.5 py-2 text-xs font-medium transition ${active ? "border-[color:var(--color-accent)] bg-[color:var(--color-accent)] text-white" : "border-[color:var(--color-line)] text-[color:var(--color-ink)] hover:border-[color:var(--color-ink-muted)]"}`}
    >
      {slug ? <CategoryIcon slug={slug} className="size-4" /> : null}
      {label}
    </Link>
  );
}

import Link from "next/link";
import { searchListings } from "@/modules/search";
import { listCategories } from "@/modules/marketplace";
import { formatKobo } from "@/lib/money";
import { Card, PageHeader } from "@/components/ui";
import { SearchBar } from "@/components/search-bar";

/** Search & category browse. PRD Section 07. */
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
    <main className="mx-auto max-w-2xl px-5 py-8">
      <PageHeader
        title={active ? active.name : "Search"}
        subtitle={`${results.length} available ${results.length === 1 ? "listing" : "listings"}`}
      />

      <SearchBar defaultValue={sp.q ?? ""} />

      <nav className="mt-4 flex gap-2 overflow-x-auto pb-1">
        <Link
          href="/search"
          className={`shrink-0 rounded-full border px-3 py-1.5 text-xs ${!sp.category ? "border-[color:var(--color-ink)] bg-[color:var(--color-ink)] text-white" : "border-[color:var(--color-line)]"}`}
        >
          All
        </Link>
        {categories.map((c) => (
          <Link
            key={c.id}
            href={`/search?category=${c.slug}`}
            className={`shrink-0 rounded-full border px-3 py-1.5 text-xs ${sp.category === c.slug ? "border-[color:var(--color-ink)] bg-[color:var(--color-ink)] text-white" : "border-[color:var(--color-line)]"}`}
          >
            {c.name}
          </Link>
        ))}
      </nav>

      {results.length === 0 ? (
        <Card className="mt-6 text-sm text-[color:var(--color-ink-muted)]">
          Nothing matches that yet. Only approved listings from verified providers appear here.
        </Card>
      ) : (
        <ul className="mt-6 space-y-3">
          {results.map((r) => (
            <li key={r.id}>
              <Link href={`/l/${r.slug}`}>
                <Card>
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{r.title}</p>
                      <p className="mt-0.5 text-xs text-[color:var(--color-ink-muted)]">
                        {r.providerName} · {r.categoryName}
                      </p>
                      {r.reviewCount > 0 ? (
                        <p className="mt-1 text-xs text-[color:var(--color-ink-muted)]">
                          {r.avgRating} ★ ({r.reviewCount})
                        </p>
                      ) : null}
                    </div>
                    <p className="shrink-0 text-sm font-medium tabular-nums">
                      {r.priceType === "fixed" && r.priceKobo !== null
                        ? formatKobo(r.priceKobo)
                        : "Price on request"}
                    </p>
                  </div>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

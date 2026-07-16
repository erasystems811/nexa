import Link from "next/link";
import type { Route } from "next";
import { searchListings, searchVendors } from "@/modules/search";
import { listCategories } from "@/modules/marketplace";
import { formatKobo } from "@/lib/money";
import { PageHeader } from "@/components/ui";
import { SearchBar } from "@/components/search-bar";
import { BackBar } from "@/components/back-bar";
import { Photo } from "@/components/photo";
import { CategoryIcon } from "@/components/category-icon";
import { VendorCard } from "@/components/vendor-card";

/**
 * Two jobs on one page:
 *
 *   Browsing — no typed query, maybe a category chip — shows VENDORS. One card
 *   per business, opening onto their menu. This is how a customer explores.
 *
 *   Searching — a typed query — shows SERVICES, across every vendor that offers
 *   one, because a customer looking for "jollof for 200" wants the dish, not a
 *   restaurant. That is the item search the model is built around.
 */
export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const isSearching = Boolean(sp.q && sp.q.trim());

  const categories = await listCategories();
  const active = categories.find((c) => c.slug === sp.category);

  const [listings, vendors] = await Promise.all([
    isSearching
      ? searchListings({
          q: sp.q,
          categorySlug: sp.category,
          citySlug: sp.city,
          minPriceKobo: sp.min ? Number(sp.min) * 100 : undefined,
          maxPriceKobo: sp.max ? Number(sp.max) * 100 : undefined,
          minRating: sp.rating ? Number(sp.rating) : undefined,
          availableAt: sp.at,
        })
      : Promise.resolve([]),
    isSearching
      ? Promise.resolve([])
      : searchVendors({ categorySlug: sp.category, citySlug: sp.city }),
  ]);

  const count = isSearching ? listings.length : vendors.length;
  const noun = isSearching
    ? `service${count === 1 ? "" : "s"}`
    : `vendor${count === 1 ? "" : "s"}`;

  return (
    <main className="mx-auto max-w-3xl px-5 py-6">
      <BackBar />
      <div className="mt-3">
        <PageHeader
          title={isSearching ? `Results for “${sp.q}”` : active ? active.name : "Browse vendors"}
          subtitle={`${count} ${noun}`}
        />
      </div>

      <SearchBar defaultValue={sp.q ?? ""} />

      <nav className="mt-4 -mx-5 flex gap-2 overflow-x-auto px-5 pb-1">
        <Chip href="/search" label="All" active={!sp.category} />
        {categories.map((c) => (
          <Chip key={c.id} href={`/search?category=${c.slug}` as Route} slug={c.slug} label={c.name} active={sp.category === c.slug} />
        ))}
      </nav>

      {count === 0 ? (
        <div className="mt-8 rounded-[var(--radius-card)] border border-dashed border-[color:var(--color-line)] p-8 text-center text-sm text-[color:var(--color-ink-muted)]">
          {isSearching
            ? "No service matches that yet. Try a different word, or browse the categories above."
            : "No vendors here yet. Only verified vendors with a live service appear."}
        </div>
      ) : isSearching ? (
        <ul className="mt-6 grid grid-cols-2 gap-4">
          {listings.map((r) => (
            <li key={r.id}>
              <Link href={`/l/${r.slug}`} className="group block overflow-hidden rounded-[var(--radius-card)] border border-[color:var(--color-line)] bg-white shadow-card transition hover:shadow-card-hover">
                <Photo
                  src={r.coverUrl}
                  alt={r.title}
                  fill
                  sizes="(max-width: 640px) 50vw, 300px"
                  className="aspect-[4/3]"
                  imageClassName="transition duration-300 group-hover:scale-[1.03]"
                />
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
      ) : (
        <ul className="mt-6 grid grid-cols-2 gap-4">
          {vendors.map((v) => (
            <li key={v.id}>
              <VendorCard vendor={v} />
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

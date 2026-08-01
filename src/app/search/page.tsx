import Link from "next/link";
import type { Route } from "next";
import { searchListings, searchVendors, type ListingFilters } from "@/modules/search";
import { listCategories } from "@/modules/marketplace";
import { SearchBar } from "@/components/search-bar";
import { CategoryIcon } from "@/components/category-icon";
import { VendorCard } from "@/components/vendor-card";
import { ListingsGrid } from "./listings-grid";

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

  const listingFilters: ListingFilters = {
    q: sp.q,
    categorySlug: sp.category,
    citySlug: sp.city,
    minPriceKobo: sp.min ? Number(sp.min) * 100 : undefined,
    maxPriceKobo: sp.max ? Number(sp.max) * 100 : undefined,
    minRating: sp.rating ? Number(sp.rating) : undefined,
    availableAt: sp.at,
  };

  const [listings, vendors] = await Promise.all([
    isSearching ? searchListings(listingFilters) : Promise.resolve([]),
    isSearching
      ? Promise.resolve([])
      : searchVendors({ categorySlug: sp.category, citySlug: sp.city }),
  ]);

  const count = isSearching ? listings.length : vendors.length;
  const noun = isSearching
    ? `service${count === 1 ? "" : "s"}`
    : `vendor${count === 1 ? "" : "s"}`;

  return (
    <div className="pb-6">
      {/* Search and filters stay reachable while scrolling results — the same
          pattern Spotify and Chowdeck use so refining never means scrolling back
          up. Negative margins match the shell's own px-4/md:px-8 so the bar
          bleeds edge to edge instead of stopping at the content column. */}
      <div className="sticky top-0 z-30 -mx-4 border-b bg-background/90 px-4 pb-3 pt-4 backdrop-blur-md md:-mx-8 md:px-8">
        <h1 className="font-serif text-2xl font-semibold tracking-tight">
          {isSearching ? `Results for "${sp.q}"` : active ? active.name : "Browse vendors"}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {count} {noun}
        </p>

        <div className="mt-3">
          <SearchBar defaultValue={sp.q ?? ""} />
        </div>

        <nav className="mt-4 -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 md:-mx-8 md:px-8">
          <Chip href="/search" label="All" active={!sp.category} />
          {categories.map((c) => (
            <Chip
              key={c.id}
              href={`/search?category=${c.slug}` as Route}
              slug={c.slug}
              label={c.name}
              active={sp.category === c.slug}
            />
          ))}
        </nav>
      </div>

      {count === 0 ? (
        <div className="mt-8 rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
          {isSearching
            ? "No service matches that yet. Try a different word, or browse the categories above."
            : "No vendors here yet. Only verified vendors with a live service appear."}
        </div>
      ) : isSearching ? (
        <ListingsGrid initial={listings} filters={listingFilters} />
      ) : (
        <ul className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4">
          {vendors.map((v) => (
            <li key={v.id}>
              <VendorCard vendor={v} />
            </li>
          ))}
        </ul>
      )}
    </div>
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
      className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3.5 py-2 text-xs font-medium transition active:scale-95 ${
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "text-foreground hover:border-muted-foreground"
      }`}
    >
      {slug ? <CategoryIcon slug={slug} className="size-4" /> : null}
      {label}
    </Link>
  );
}

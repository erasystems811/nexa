import { listCategories, categoryImages } from "@/modules/marketplace";
import { searchVendors } from "@/modules/search";
import Link from "next/link";
import type { Route } from "next";
import Image from "next/image";
import { SearchBar } from "@/components/search-bar";
import { CategoryIcon } from "@/components/category-icon";
import { VendorCard } from "@/components/vendor-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

/**
 * Marketplace home — Nexa's brand/nav chrome lives in the sidebar shell now
 * (see src/components/customer-shell.tsx), so this is just the hero and the
 * browse feed, not a self-contained page-with-header like it used to be.
 */
export default async function HomePage() {
  const [categories, images, vendors] = await Promise.all([
    listCategories(),
    categoryImages(),
    searchVendors({ limit: 24 }),
  ]);

  return (
    <div className="space-y-14 pb-8">
      {/* A soft glow behind the hero — the one purely decorative brand touch,
          the kind of detail that separates a landing page from a template. */}
      <section className="relative max-w-2xl overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute -top-24 left-0 h-[26rem] w-[36rem] rounded-full bg-primary/[0.07] blur-3xl"
        />
        <div className="relative">
          <h1 className="font-serif text-5xl font-bold leading-[1.08] tracking-tight text-primary md:text-6xl">
            Everything your event needs,
            <br />
            booked with confidence.
          </h1>
          <div className="mt-8">
            <SearchBar />
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Badge variant="secondary">Verified vendors</Badge>
            <Badge variant="secondary">Payment held until delivery</Badge>
            <Link href={"/apply" as Route} className="ml-auto">
              <Button variant="outline" size="sm">
                List your business
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {categories.length > 0 ? (
        <section>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-serif text-xl font-semibold">Browse by category</h2>
          </div>
          <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-1 md:-mx-8 md:px-8">
            {categories.map((c) => {
              const image = images[c.slug];
              return (
                <Link key={c.id} href={`/search?category=${c.slug}`} className="group shrink-0">
                  <div className="relative h-28 w-28 overflow-hidden rounded-2xl border bg-card transition duration-200 group-hover:-translate-y-0.5 group-hover:border-primary group-hover:shadow-md">
                    {image ? (
                      <>
                        <Image src={image} alt="" fill sizes="112px" className="object-cover" />
                        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-2 pb-2 pt-6">
                          <span className="text-center text-[11px] font-medium leading-tight text-white">
                            {c.name}
                          </span>
                        </div>
                      </>
                    ) : (
                      <div className="flex h-full w-full flex-col items-center justify-center gap-2.5">
                        <CategoryIcon
                          slug={c.slug}
                          className="size-7 text-muted-foreground transition-colors group-hover:text-primary"
                        />
                        <span className="px-2 text-center text-[11px] font-medium leading-tight">{c.name}</span>
                      </div>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      ) : null}

      {vendors.length > 0 ? (
        <section>
          <div className="mb-4 flex items-center justify-between gap-4">
            <h2 className="font-serif text-xl font-semibold">Vendors on Nexa</h2>
            <Link href={"/search" as Route} className="shrink-0 text-sm font-medium text-primary hover:opacity-80">
              View all
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
            {vendors.map((v) => (
              <VendorCard key={v.id} vendor={v} />
            ))}
          </div>
        </section>
      ) : null}

      <section>
        <div className="relative flex items-center justify-between gap-4 overflow-hidden rounded-2xl bg-primary px-6 py-4 text-primary-foreground">
          <div
            aria-hidden
            className="pointer-events-none absolute -right-10 -top-10 size-40 rounded-full bg-white/10 blur-2xl"
          />
          <h2 className="relative font-serif text-base sm:text-lg">Let Nexa plan your event for you</h2>
          <p className="relative shrink-0 font-serif text-lg italic opacity-90 sm:text-xl">Nexa it!</p>
        </div>
      </section>

      <footer className="border-t pt-6 text-center text-xs text-muted-foreground">
        <p>
          <Link href="/contact" className="underline hover:text-foreground">
            Contact us
          </Link>
          <span className="mx-2">·</span>
          <Link href="/privacy" className="underline hover:text-foreground">
            Privacy
          </Link>
          <span className="mx-2">·</span>
          <Link href="/terms" className="underline hover:text-foreground">
            Terms
          </Link>
        </p>
        <p className="mt-4 text-[10px] text-muted-foreground/60">
          Powered by{" "}
          <a
            href="https://erasystems.com.ng"
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-2 hover:text-foreground"
          >
            ERA Systems
          </a>
        </p>
      </footer>
    </div>
  );
}

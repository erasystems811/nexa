import { listCategories, categoryImages } from "@/modules/marketplace";
import { searchVendors } from "@/modules/search";
import { getSession } from "@/modules/auth";
import Link from "next/link";
import Image from "next/image";
import { Logo } from "@/components/logo";
import { SearchBar } from "@/components/search-bar";
import { CategoryIcon } from "@/components/category-icon";
import { VendorCard } from "@/components/vendor-card";
import { Badge } from "@/components/ui";

/** Marketplace home. */
export default async function HomePage() {
  const session = await getSession();
  const [categories, images, vendors] = await Promise.all([
    listCategories(),
    categoryImages(),
    searchVendors({ limit: 24 }),
  ]);

  return (
    <>
      {/* Sticky and translucent, the way Spotify/Netflix keep their nav present
          without it feeling heavy — it never competes with what's underneath it. */}
      <header className="sticky top-0 z-40 border-b border-[color:var(--color-line)]/60 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-5 py-4">
          <Link href="/" aria-label="Nexa home">
            <Logo markClassName="size-9 rounded-[1rem]" textClassName="text-base" />
          </Link>
          <nav className="flex items-center gap-5 text-sm">
            <Link href="/apply" className="text-[color:var(--color-ink-muted)] transition-colors hover:text-[color:var(--color-ink)]">
              Apply to be a vendor
            </Link>
            {session ? (
              <Link href="/account" className="font-medium">Account</Link>
            ) : (
              <Link
                href="/login"
                className="rounded-full bg-[color:var(--color-accent)] px-4 py-2 font-medium text-white transition-transform active:scale-95"
              >
                Get started
              </Link>
            )}
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-5 pb-16">
        {/* A soft glow behind the hero — the one purely decorative brand touch,
            the kind of detail that separates a landing page from a template. */}
        <section className="relative overflow-hidden pt-12">
          <div
            aria-hidden
            className="pointer-events-none absolute -top-24 left-1/2 h-[26rem] w-[36rem] -translate-x-1/2 rounded-full bg-[color:var(--color-accent)]/[0.07] blur-3xl"
          />
          <div className="relative">
            <h1 className="font-display text-[2.4rem] leading-[1.08] tracking-tight sm:text-6xl">
              Everything your event needs,
              <br />
              <span className="text-[color:var(--color-accent)]">booked with confidence.</span>
            </h1>
            <div className="mt-8">
              <SearchBar />
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Badge tone="accent">Verified vendors</Badge>
              <Badge>Payment held until delivery</Badge>
            </div>
          </div>
        </section>

        {categories.length > 0 ? (
          <section className="mt-14">
            <h2 className="mb-4 text-sm font-semibold text-[color:var(--color-ink-muted)]">Browse by category</h2>
            <div className="-mx-5 flex gap-3 overflow-x-auto px-5 pb-1">
              {categories.map((c) => {
                const image = images[c.slug];
                return (
                  <Link key={c.id} href={`/search?category=${c.slug}`} className="group shrink-0">
                    <div className="flex h-28 w-28 flex-col items-center justify-center gap-2.5 rounded-2xl border border-[color:var(--color-line)] bg-white transition duration-200 group-hover:-translate-y-0.5 group-hover:border-[color:var(--color-accent)] group-hover:shadow-card">
                      {image ? (
                        <Image
                          src={image}
                          alt=""
                          width={48}
                          height={48}
                          className="size-12 rounded-xl object-cover"
                        />
                      ) : (
                        <CategoryIcon
                          slug={c.slug}
                          className="size-7 text-[color:var(--color-ink-muted)] transition-colors group-hover:text-[color:var(--color-accent)]"
                        />
                      )}
                      <span className="px-2 text-center text-[11px] font-medium leading-tight">{c.name}</span>
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>
        ) : null}

        {vendors.length > 0 ? (
          <section className="mt-14">
            <h2 className="mb-4 text-sm font-semibold text-[color:var(--color-ink-muted)]">
              Vendors on Nexa
            </h2>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
              {vendors.map((v) => (
                <VendorCard key={v.id} vendor={v} />
              ))}
            </div>
          </section>
        ) : null}

        <section className="mt-14">
          <div className="relative flex items-center justify-between gap-4 overflow-hidden rounded-[var(--radius-card)] bg-[color:var(--color-accent)] px-6 py-4 text-white">
            <div
              aria-hidden
              className="pointer-events-none absolute -right-10 -top-10 size-40 rounded-full bg-white/10 blur-2xl"
            />
            <h2 className="relative font-display text-base sm:text-lg">Let Nexa plan your event for you</h2>
            <p className="relative shrink-0 font-display text-lg italic text-white/90 sm:text-xl">Nexa it!</p>
          </div>
        </section>

        <footer className="mt-14 border-t border-[color:var(--color-line)] pt-6 text-center text-xs text-[color:var(--color-ink-muted)]">
          <p>
            <Link href="/privacy" className="underline hover:text-[color:var(--color-ink)]">
              Privacy
            </Link>
            <span className="mx-2">·</span>
            <Link href="/terms" className="underline hover:text-[color:var(--color-ink)]">
              Terms
            </Link>
          </p>
          <p className="mt-4 text-[10px] text-[color:var(--color-ink-muted)]/60">
            Powered by{" "}
            <a
              href="https://erasystems.com.ng"
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-2 hover:text-[color:var(--color-ink)]"
            >
              ERA Systems
            </a>
          </p>
        </footer>
      </main>
    </>
  );
}

import { listCategories, categoryImages } from "@/modules/marketplace";
import { searchVendors } from "@/modules/search";
import { getSession } from "@/modules/auth";
import { FLAGS, isEnabled } from "@/modules/settings";
import Link from "next/link";
import { Logo } from "@/components/logo";
import { SearchBar } from "@/components/search-bar";
import { CategoryIcon } from "@/components/category-icon";
import { VendorCard } from "@/components/vendor-card";

/** Marketplace home. */
export default async function HomePage() {
  const session = await getSession();
  const [categories, planMyEventLive, images, vendors] = await Promise.all([
    listCategories(),
    isEnabled(FLAGS.planMyEvent, session?.profile.role),
    categoryImages(),
    searchVendors({ limit: 24 }),
  ]);

  return (
    <main className="mx-auto max-w-3xl px-5 pb-16">
      <header className="flex items-center justify-between py-5">
        <Link href="/" aria-label="Nexa home">
          <Logo markClassName="size-10 rounded-[1.1rem]" textClassName="text-lg" />
        </Link>
        <nav className="flex items-center gap-5 text-sm">
          <Link href="/apply" className="hidden text-[color:var(--color-ink-muted)] hover:text-[color:var(--color-ink)] sm:block">
            Apply to be a vendor
          </Link>
          {session ? (
            <>
              <Link href="/orders" className="text-[color:var(--color-ink-muted)] hover:text-[color:var(--color-ink)]">My orders</Link>
              <Link href="/account" className="font-medium">Account</Link>
            </>
          ) : (
            <Link href="/login" className="rounded-full bg-[color:var(--color-accent)] px-4 py-2 font-medium text-white">Get started</Link>
          )}
        </nav>
      </header>

      <section className="pt-6">
        <h1 className="text-[2.1rem] font-semibold leading-[1.1] tracking-tight sm:text-5xl">
          Everything your event needs,<br />
          <span className="text-[color:var(--color-accent)]">booked with confidence.</span>
        </h1>
        <p className="mt-4 max-w-lg text-[15px] leading-relaxed text-[color:var(--color-ink-muted)]">
          Find verified caterers, decorators, DJs, transport services and more. Nexa keeps your payment
          protected until your event is successfully completed.
        </p>
        <div className="mt-6">
          <SearchBar />
        </div>
        <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs text-[color:var(--color-ink-muted)]">
          <span>Verified providers</span>
          <span>Your money stays safe until the event is done.</span>
          <span>Event-ready services</span>
        </div>
      </section>

      {categories.length > 0 ? (
        <section className="mt-12">
          <h2 className="mb-4 text-sm font-semibold text-[color:var(--color-ink-muted)]">Browse by category</h2>
          <div className="-mx-5 flex gap-3 overflow-x-auto px-5 pb-1">
            {categories.map((c) => (
              <Link key={c.id} href={`/search?category=${c.slug}`} className="group shrink-0">
                <div className="flex h-28 w-28 flex-col items-center justify-center gap-2.5 rounded-2xl border border-[color:var(--color-line)] bg-white transition duration-200 group-hover:-translate-y-0.5 group-hover:border-[color:var(--color-accent)] group-hover:shadow-card">
                  {images[c.slug] ? (
                    // eslint-disable-next-line @next/next/no-img-element -- Supabase storage, no loader configured
                    <img
                      src={images[c.slug]}
                      alt=""
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
            ))}
          </div>
        </section>
      ) : null}

      {vendors.length > 0 ? (
        <section className="mt-12">
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

      <section className="mt-12">
        <div className="overflow-hidden rounded-[var(--radius-card)] bg-[color:var(--color-accent)] p-6 text-white">
          <h2 className="text-lg font-semibold">Plan My Event</h2>
          <p className="mt-1 max-w-md text-sm text-white/80">
            {planMyEventLive
              ? "Tell us the event, budget and guest count - we'll assemble a package."
              : "Coming soon - tell us the event, and we'll assemble the whole package for you."}
          </p>
        </div>
      </section>

      <section className="mt-12">
        <div className="rounded-[var(--radius-card)] border border-[color:var(--color-line)] bg-white p-6 text-center shadow-card">
          <h2 className="text-lg font-semibold">Do you provide an event service?</h2>
          <p className="mx-auto mt-1 max-w-md text-sm text-[color:var(--color-ink-muted)]">
            Caterers, DJs, photographers, decorators, transport, security and more. List your
            business on Nexa and get booked.
          </p>
          <Link href="/apply" className="mt-4 inline-block rounded-full bg-[color:var(--color-ink)] px-6 py-3 text-sm font-medium text-white">
            Apply to be a vendor
          </Link>
        </div>
      </section>

      <footer className="mt-14 border-t border-[color:var(--color-line)] pt-6 text-center text-xs text-[color:var(--color-ink-muted)]">
        <p>
          Nexa - powered by ERA. Your payment is held securely until your event is successfully
          completed.
        </p>
        <p className="mt-3">
          <Link href="/privacy" className="underline hover:text-[color:var(--color-ink)]">
            Privacy
          </Link>
          <span className="mx-2">·</span>
          <Link href="/terms" className="underline hover:text-[color:var(--color-ink)]">
            Terms
          </Link>
          <span className="mx-2">·</span>
          <Link href="/apply" className="underline hover:text-[color:var(--color-ink)]">
            Apply to be a vendor
          </Link>
        </p>
      </footer>
    </main>
  );
}

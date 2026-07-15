import Link from "next/link";
import { listCategories, categoryImages, recentListings } from "@/modules/marketplace";
import { formatKobo } from "@/lib/money";
import { getSession } from "@/modules/auth";
import { FLAGS, isEnabled } from "@/modules/settings";
import { Logo } from "@/components/logo";
import { SearchBar } from "@/components/search-bar";
import { CategoryIcon } from "@/components/category-icon";

/** Marketplace home. */
export default async function HomePage() {
  const session = await getSession();
  const [categories, planMyEventLive, images, listings] = await Promise.all([
    listCategories(),
    isEnabled(FLAGS.planMyEvent, session?.profile.role),
    categoryImages(),
    recentListings(8),
  ]);

  return (
    <main className="mx-3 my-3 max-w-3xl overflow-hidden rounded-[1.75rem] border border-[color:var(--color-line)] bg-white px-5 pb-16 shadow-card sm:mx-auto sm:my-8">
      <header className="flex items-center justify-between py-5">
        <Link href="/" aria-label="Nexa home">
          <Logo markClassName="size-10 rounded-[1.1rem]" textClassName="text-lg" />
        </Link>
        <nav className="flex items-center gap-5 text-sm">
          <Link href="/apply" className="hidden text-[color:var(--color-ink-muted)] hover:text-[color:var(--color-ink)] sm:block">
            Become a vendor
          </Link>
          {session ? (
            <>
              <Link href="/orders" className="text-[color:var(--color-ink-muted)] hover:text-[color:var(--color-ink)]">My events</Link>
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

      {listings.length > 0 ? (
        <section className="mt-12">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-[color:var(--color-ink-muted)]">
              Fresh on Nexa
            </h2>
            <Link href="/search" className="text-xs font-medium text-[color:var(--color-accent)]">
              See all
            </Link>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {listings.map((l) => {
              const provider = l.providers as unknown as {
                business_name: string;
                slug: string;
                cover_url: string | null;
                cities: { name: string } | null;
              };
              const category = l.categories as unknown as { name: string } | null;
              const price =
                l.price_type === "fixed" && l.price_kobo != null
                  ? `From ${formatKobo(l.price_kobo)}`
                  : "Price on request";
              return (
                <Link
                  key={l.id}
                  href={`/l/${l.slug}`}
                  className="group overflow-hidden rounded-2xl border border-[color:var(--color-line)] bg-white transition duration-200 hover:-translate-y-0.5 hover:shadow-card"
                >
                  {provider.cover_url ? (
                    // eslint-disable-next-line @next/next/no-img-element -- Supabase storage, no loader configured
                    <img
                      src={provider.cover_url}
                      alt=""
                      className="h-32 w-full object-cover"
                    />
                  ) : (
                    <div className="h-32 w-full bg-[color:var(--color-surface-sunk)]" />
                  )}
                  <div className="p-4">
                    <p className="text-sm font-semibold leading-snug">{l.title}</p>
                    <p className="mt-1 text-xs text-[color:var(--color-ink-muted)]">
                      {provider.business_name}
                      {provider.cities?.name ? ` · ${provider.cities.name}` : ""}
                    </p>
                    <div className="mt-3 flex items-center justify-between">
                      <span className="rounded-full bg-[color:var(--color-surface-sunk)] px-2.5 py-1 text-[11px] font-medium text-[color:var(--color-ink-muted)]">
                        {category?.name ?? "Service"}
                      </span>
                      <span className="text-sm font-medium tabular-nums">{price}</span>
                    </div>
                  </div>
                </Link>
              );
            })}
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
            Apply to become a vendor
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
            Become a vendor
          </Link>
        </p>
      </footer>
    </main>
  );
}

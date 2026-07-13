import Link from "next/link";
import { featuredProviders, listCategories } from "@/modules/marketplace";
import { getSession } from "@/modules/auth";
import { FLAGS, isEnabled } from "@/modules/settings";
import { SearchBar } from "@/components/search-bar";

/** Marketplace home. PRD Section 14 + Addendum Â§3 (premium, image-led). */
export default async function HomePage() {
  const session = await getSession();
  const [categories, providers, planMyEventLive] = await Promise.all([
    listCategories(),
    featuredProviders(8),
    isEnabled(FLAGS.planMyEvent, session?.profile.role),
  ]);

  return (
    <main className="mx-auto max-w-3xl px-5 pb-16">
      {/* Top bar */}
      <header className="flex items-center justify-between py-5">
        <span className="text-lg font-semibold tracking-tight">Nexa</span>
        <nav className="flex items-center gap-5 text-sm">
          {session ? (
            <>
              <Link href="/orders" className="text-[color:var(--color-ink-muted)] hover:text-[color:var(--color-ink)]">My events</Link>
              <Link href="/account" className="font-medium">Account</Link>
            </>
          ) : (
            <Link href="/login" className="rounded-full bg-[color:var(--color-accent)] px-4 py-2 font-medium text-white">Sign in</Link>
          )}
        </nav>
      </header>

      {/* Hero */}
      <section className="pt-6">
        <h1 className="text-[2.1rem] font-semibold leading-[1.1] tracking-tight sm:text-5xl">
          Everything your event needs,<br />
          <span className="text-[color:var(--color-accent)]">booked with confidence.</span>
        </h1>
        <p className="mt-4 max-w-lg text-[15px] leading-relaxed text-[color:var(--color-ink-muted)]">
          Book verified DJs, caterers, decorators and more. Nexa holds your payment safely until your
          event is done â€” so you can relax.
        </p>
        <div className="mt-6">
          <SearchBar />
        </div>
        <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs text-[color:var(--color-ink-muted)]">
          <span>âœ“ Verified providers</span>
          <span>âœ“ Payment held until it&rsquo;s done</span>
          <span>âœ“ Real reviews</span>
        </div>
      </section>

      {/* Categories */}
      {categories.length > 0 ? (
        <section className="mt-12">
          <h2 className="mb-4 text-sm font-semibold text-[color:var(--color-ink-muted)]">Browse by category</h2>
          <div className="-mx-5 flex gap-3 overflow-x-auto px-5 pb-1">
            {categories.map((c) => (
              <Link key={c.id} href={`/search?category=${c.slug}`} className="group shrink-0">
                <div className="flex h-24 w-24 flex-col items-center justify-center gap-2 rounded-2xl border border-[color:var(--color-line)] bg-white transition group-hover:border-[color:var(--color-accent)] group-hover:shadow-card">
                  <span className="text-2xl">{c.icon ?? "âœ¨"}</span>
                  <span className="px-2 text-center text-[11px] font-medium leading-tight">{c.name}</span>
                </div>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      {/* Featured providers */}
      {providers.length > 0 ? (
        <section className="mt-12">
          <div className="mb-4 flex items-baseline justify-between">
            <h2 className="text-sm font-semibold text-[color:var(--color-ink-muted)]">Featured & top-rated</h2>
            <Link href="/search" className="text-xs font-medium text-[color:var(--color-accent)]">See all</Link>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {providers.map((p) => (
              <Link key={p.id} href={`/p/${p.slug}`} className="group overflow-hidden rounded-[var(--radius-card)] border border-[color:var(--color-line)] bg-white shadow-card transition hover:shadow-card-hover">
                <div className="relative aspect-[4/3] overflow-hidden bg-[color:var(--color-surface-sunk)]">
                  {p.cover_url ? (
                    // eslint-disable-next-line @next/next/no-img-element -- external demo/provider imagery
                    <img src={p.cover_url} alt={p.business_name} className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]" />
                  ) : null}
                  {p.is_featured ? (
                    <span className="absolute left-2 top-2 rounded-full bg-white/95 px-2 py-0.5 text-[10px] font-semibold text-[color:var(--color-accent)] shadow-sm">Featured</span>
                  ) : null}
                </div>
                <div className="p-3">
                  <div className="flex items-center gap-1">
                    <p className="truncate text-sm font-semibold">{p.business_name}</p>
                    <span title="Verified" className="text-[color:var(--color-accent)]">âœ“</span>
                  </div>
                  <p className="mt-0.5 truncate text-xs text-[color:var(--color-ink-muted)]">
                    {(p.cities as unknown as { name: string } | null)?.name ?? "Nexa provider"}
                    {p.reviewCount > 0 ? ` Â· ${p.avgRating}â˜…` : ""}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      ) : (
        <section className="mt-12">
          <div className="rounded-[var(--radius-card)] border border-dashed border-[color:var(--color-line)] p-8 text-center text-sm text-[color:var(--color-ink-muted)]">
            No providers yet. The first one goes live the day the first verified vendor is onboarded.
          </div>
        </section>
      )}

      {/* Plan My Event */}
      <section className="mt-12">
        <div className="overflow-hidden rounded-[var(--radius-card)] bg-[color:var(--color-accent)] p-6 text-white">
          <h2 className="text-lg font-semibold">Plan My Event</h2>
          <p className="mt-1 max-w-md text-sm text-white/80">
            {planMyEventLive
              ? "Tell us the event, budget and guest count â€” we&rsquo;ll assemble a package."
              : "Coming soon â€” tell us the event, and we&rsquo;ll assemble the whole package for you."}
          </p>
        </div>
      </section>

      <footer className="mt-14 border-t border-[color:var(--color-line)] pt-6 text-center text-xs text-[color:var(--color-ink-muted)]">
        Nexa â€” powered by ERA. Your payment is held securely until your event is successfully completed.
      </footer>
    </main>
  );
}

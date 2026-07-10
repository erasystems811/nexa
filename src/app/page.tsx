import Link from "next/link";
import { featuredProviders, listCategories } from "@/modules/marketplace";
import { getSession } from "@/modules/auth";
import { FLAGS, isEnabled } from "@/modules/settings";
import { Card } from "@/components/ui";
import { SearchBar } from "@/components/search-bar";

/** Marketplace home. PRD Section 14. */
export default async function HomePage() {
  const session = await getSession();
  const [categories, providers, planMyEventLive] = await Promise.all([
    listCategories(),
    featuredProviders(),
    isEnabled(FLAGS.planMyEvent, session?.profile.role),
  ]);

  return (
    <main className="mx-auto max-w-2xl px-5 py-8">
      <header className="flex items-center justify-between">
        <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--color-ink-muted)]">Nexa</p>
        <nav className="flex items-center gap-4 text-sm">
          {session ? (
            <>
              <Link href="/orders" className="underline">Orders</Link>
              <Link href="/messages" className="underline">Messages</Link>
              <Link href="/account" className="underline">Account</Link>
            </>
          ) : (
            <Link href="/login" className="underline">Sign in</Link>
          )}
        </nav>
      </header>

      <h1 className="mt-8 text-3xl font-semibold leading-tight tracking-tight">
        Open one app. Close it knowing your event is under control.
      </h1>
      <p className="mt-2 text-[color:var(--color-ink-muted)]">
        Book verified providers. Nexa holds your payment until the job is done.
      </p>

      <div className="mt-6">
        <SearchBar />
      </div>

      <section className="mt-10">
        <h2 className="text-sm font-medium">Categories</h2>
        {categories.length > 0 ? (
          <ul className="mt-3 grid grid-cols-2 gap-3">
            {categories.map((c) => (
              <li key={c.id}>
                <Link href={`/search?category=${c.slug}`}>
                  <Card className="text-sm font-medium">{c.name}</Card>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <Card className="mt-3 text-sm text-[color:var(--color-ink-muted)]">
            No categories yet. The first one goes live the day the first verified provider does.
          </Card>
        )}
      </section>

      {providers.length > 0 ? (
        <section className="mt-8">
          <h2 className="text-sm font-medium">Featured & top-rated</h2>
          <ul className="mt-3 space-y-3">
            {providers.map((p) => (
              <li key={p.id}>
                <Link href={`/p/${p.slug}`}>
                  <Card className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">{p.business_name}</p>
                      <p className="mt-0.5 text-xs text-[color:var(--color-ink-muted)]">
                        {p.reviewCount > 0
                          ? `${p.avgRating} · ${p.reviewCount} review${p.reviewCount === 1 ? "" : "s"}`
                          : "No reviews yet"}
                      </p>
                    </div>
                    {p.is_featured ? (
                      <span className="rounded-full bg-[color:var(--color-surface-sunk)] px-2.5 py-1 text-[11px] font-medium">
                        Featured
                      </span>
                    ) : null}
                  </Card>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="mt-8">
        <Card>
          <h2 className="text-sm font-medium">Plan My Event</h2>
          <p className="mt-1 text-sm text-[color:var(--color-ink-muted)]">
            {planMyEventLive
              ? "Tell us the event. We'll assemble the providers."
              : "Coming soon — tell us the event, and we'll assemble the providers."}
          </p>
        </Card>
      </section>
    </main>
  );
}

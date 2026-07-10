import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/modules/auth";
import { FLAGS, isEnabled } from "@/modules/settings";
import { Card } from "@/components/ui";

/**
 * Marketplace home. PRD Section 14.
 *
 * The category strip is read from the database and starts empty on purpose:
 * "There is no fixed launch category list... Admin adds a category the moment
 * the first real, verified provider in that category is onboarded" (Section 01).
 */
export default async function HomePage() {
  const supabase = await createClient();
  const session = await getSession();

  const { data: categories } = await supabase
    .from("categories")
    .select("id, name, slug")
    .order("sort_order");

  const planMyEventLive = await isEnabled(FLAGS.planMyEvent, session?.profile.role);

  return (
    <main className="mx-auto max-w-2xl px-5 py-10">
      <header className="flex items-center justify-between">
        <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--color-ink-muted)]">
          Nexa
        </p>
        {session ? (
          <Link href="/account" className="text-sm font-medium underline">
            Account
          </Link>
        ) : (
          <Link href="/login" className="text-sm font-medium underline">
            Sign in
          </Link>
        )}
      </header>

      <h1 className="mt-10 text-3xl font-semibold leading-tight tracking-tight">
        Open one app. Close it knowing your event is under control.
      </h1>
      <p className="mt-3 text-[color:var(--color-ink-muted)]">
        Book verified providers. Nexa holds your payment until the job is done.
      </p>

      <section className="mt-10">
        <h2 className="text-sm font-medium">Categories</h2>
        {categories && categories.length > 0 ? (
          <ul className="mt-3 grid grid-cols-2 gap-3">
            {categories.map((c) => (
              <li key={c.id}>
                <Card className="text-sm font-medium">{c.name}</Card>
              </li>
            ))}
          </ul>
        ) : (
          <Card className="mt-3 text-sm text-[color:var(--color-ink-muted)]">
            No categories yet. The first one goes live the day the first verified
            provider does.
          </Card>
        )}
      </section>

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

import Link from "next/link";
import { listCategories, listCities } from "@/modules/marketplace";
import { ID_TYPES, ACCEPTED_ID_MIME_TYPES } from "@/modules/provider";
import { Logo } from "@/components/logo";
import { PageHeader } from "@/components/ui";
import { ApplyForm } from "./apply-form";
import { surfaceOrigin } from "@/lib/surfaces";

export const metadata = {
  title: "Become a Nexa vendor",
  description: "Apply to sell your event service on Nexa.",
};

/**
 * The way in. Public, no sign-in — a business cannot be asked to have an account
 * before it is allowed to ask for one.
 */
export default async function ApplyPage() {
  const [categories, cities] = await Promise.all([listCategories(), listCities()]);

  return (
    <main className="mx-auto max-w-xl px-5 pb-16">
      <header className="flex items-center justify-between py-5">
        <Link href="/" aria-label="Nexa home">
          <Logo markClassName="size-10 rounded-[1.1rem]" textClassName="text-lg" />
        </Link>
        <Link
          href="/login"
          className="text-sm text-[color:var(--color-ink-muted)] hover:text-[color:var(--color-ink)]"
        >
          Already a vendor? Sign in
        </Link>
      </header>

      <PageHeader
        title="Become a Nexa vendor"
        subtitle="Tell us about your business. Nexa reviews it, and once you are approved you get Business Studio — your listings, your bookings, and your payouts."
      />

      <div className="mb-6 rounded-[var(--radius-card)] bg-[color:var(--color-accent-soft)] p-4 text-sm text-[color:var(--color-accent)]">
        Customers pay Nexa, not you. Nexa holds the whole amount and pays you once the job is done —
        so you never chase anybody for money.
      </div>

      <ApplyForm
        categories={categories.map((c) => ({ id: c.id, name: c.name }))}
        cities={cities.map((c) => ({ id: c.id, name: c.name }))}
        idTypes={ID_TYPES.map((t) => ({ value: t.value, label: t.label, needsNumber: t.needsNumber }))}
        acceptedMimeTypes={[...ACCEPTED_ID_MIME_TYPES]}
        // This page lives on the CUSTOMER domain — it is where a vendor finds
        // Nexa. But signing in belongs on the vendor domain, or the person who
        // just applied to sell lands back on the marketplace they came from.
        // In dev there are no subdomains, so the path is the best we can do.
        vendorLoginUrl={`${surfaceOrigin("studio") ?? ""}/login`}
      />
    </main>
  );
}

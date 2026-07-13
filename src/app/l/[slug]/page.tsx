import Link from "next/link";
import type { Route } from "next";
import { notFound } from "next/navigation";
import { getListingBySlug } from "@/modules/marketplace";
import { checkpointsFor } from "@/modules/bookings";
import { discussListingAction } from "@/modules/bookings/actions";
import { getSession } from "@/modules/auth";
import { formatKobo } from "@/lib/money";
import { Button, Card, PageHeader } from "@/components/ui";

/** Listing page. PRD Section 14. */
export default async function ListingPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const listing = await getListingBySlug(slug);
  if (!listing) notFound();

  const session = await getSession();
  const category = listing.categories;
  const provider = listing.providers;
  const checkpoints = checkpointsFor(category.fulfillment_type);
  const isFixed = listing.price_type === "fixed";

  const cover = (provider as unknown as { cover_url: string | null }).cover_url;
  const bookPath = `/book/${listing.id}` as Route;
  const loginPath = `/login?next=${encodeURIComponent(bookPath)}` as Route;

  return (
    <main className="mx-auto max-w-2xl pb-16">
      <div className="relative aspect-[16/9] w-full overflow-hidden bg-[color:var(--color-surface-sunk)]">
        {cover ? (
          // eslint-disable-next-line @next/next/no-img-element -- external provider imagery
          <img src={cover} alt={listing.title} className="h-full w-full object-cover" />
        ) : null}
        <Link href={`/p/${provider.slug}`} className="absolute left-4 top-4 rounded-full bg-white/90 px-3 py-1.5 text-xs font-medium shadow-sm">← Back</Link>
      </div>

      <div className="px-5 pt-5">
      <PageHeader title={listing.title} subtitle={listing.description ?? undefined} />

      <Card>
        <div className="flex items-baseline justify-between">
          <p className="text-sm text-[color:var(--color-ink-muted)]">
            {isFixed ? "Price" : "Price on request"}
          </p>
          <p className="text-2xl font-semibold tabular-nums text-[color:var(--color-accent)]">
            {isFixed && listing.price_kobo !== null
              ? formatKobo(listing.price_kobo)
              : listing.price_min_kobo && listing.price_max_kobo
                ? `${formatKobo(listing.price_min_kobo)} – ${formatKobo(listing.price_max_kobo)}`
                : "—"}
          </p>
        </div>

        <p className="mt-4 text-xs text-[color:var(--color-ink-muted)]">
          <Link href={`/p/${provider.slug}`} className="underline">
            {provider.business_name}
          </Link>{" "}
          · {category.name}
        </p>
      </Card>

      <div className="mt-4 rounded-[var(--radius-card)] bg-[color:var(--color-accent-soft)] p-4 text-sm text-[color:var(--color-accent)]">
        🔒 Your payment is securely held by Nexa until your event is successfully completed.
      </div>

      <Card className="mt-4">
        <h2 className="text-sm font-medium">How payment works</h2>
        <p className="mt-1 text-sm text-[color:var(--color-ink-muted)]">
          Nexa holds your money. It is released in two stages, and never because
          someone tapped &ldquo;done&rdquo;.
        </p>
        <ol className="mt-3 space-y-2 text-sm">
          <li className="flex gap-3">
            <span className="shrink-0 font-medium tabular-nums">1.</span>
            <span>{checkpoints.stage1}</span>
          </li>
          <li className="flex gap-3">
            <span className="shrink-0 font-medium tabular-nums">2.</span>
            <span>{checkpoints.stage2}</span>
          </li>
        </ol>
        {listing.caution_fee_kobo > 0 ? (
          <p className="mt-3 text-xs text-[color:var(--color-ink-muted)]">
            A refundable caution fee of {formatKobo(listing.caution_fee_kobo)} is held
            separately and returned when the items come back in good condition.
          </p>
        ) : null}
      </Card>

      <div className="mt-6">
        {!session ? (
          <div>
            <Link href={loginPath}>
              <Button className="w-full">Continue to booking</Button>
            </Link>
            <p className="mt-2 text-center text-xs text-[color:var(--color-ink-muted)]">
              You only sign in if your one-time session has expired.
            </p>
          </div>
        ) : isFixed ? (
          <Link href={bookPath}>
            <Button className="w-full">Book this</Button>
          </Link>
        ) : (
          // Section 08: a negotiable listing has no price to pay yet. Talk first.
          <form action={discussListingAction}>
            <input type="hidden" name="listingId" value={listing.id} />
            <Button type="submit" className="w-full">
              Discuss price
            </Button>
            <p className="mt-2 text-center text-xs text-[color:var(--color-ink-muted)]">
              Agree a price in chat. A booking is created once you accept an offer.
            </p>
          </form>
        )}
      </div>
      </div>
    </main>
  );
}

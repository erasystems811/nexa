import Link from "next/link";
import type { Route } from "next";
import { notFound } from "next/navigation";
import { getListingBySlug } from "@/modules/marketplace";
import { getSession } from "@/modules/auth";
import { formatKobo } from "@/lib/money";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ChatOnWhatsApp, PrivacyNote } from "@/components/chat-cta";
import { Photo } from "@/components/photo";
import { ShieldCheck } from "lucide-react";

/** Listing page. */
export default async function ListingPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const listing = await getListingBySlug(slug);
  if (!listing) notFound();

  const session = await getSession();
  const category = listing.categories;
  const provider = listing.providers;
  const isFixed = listing.price_type === "fixed";

  // The listing's own uploaded photo first; the provider's banner only as a
  // fallback for a listing with no image of its own.
  const cover =
    (listing as unknown as { coverUrl: string | null }).coverUrl ??
    (provider as unknown as { cover_url: string | null }).cover_url;
  const listingPath = `/l/${listing.slug}`;
  const bookPath = `/book/${listing.id}` as Route;
  const loginToBookPath = `/login?next=${encodeURIComponent(bookPath)}` as Route;

  return (
    <div className="max-w-2xl pb-8">
      <Photo
        src={cover}
        alt={listing.title}
        fill
        priority
        sizes="(max-width: 640px) 100vw, 672px"
        className="aspect-[16/9] rounded-2xl"
      />

      <div className="pt-5">
        <h1 className="font-serif text-3xl font-bold text-primary">{listing.title}</h1>
        {listing.description ? <p className="mt-1 text-sm text-muted-foreground">{listing.description}</p> : null}

        <Card className="mt-4">
          <CardContent className="pt-6">
            <div className="flex items-baseline justify-between">
              <p className="text-sm text-muted-foreground">{isFixed ? "Price" : "Price on request"}</p>
              <p className="text-2xl font-semibold tabular-nums text-primary">
                {isFixed && listing.price_kobo !== null
                  ? formatKobo(listing.price_kobo)
                  : listing.price_min_kobo && listing.price_max_kobo
                    ? `${formatKobo(listing.price_min_kobo)} – ${formatKobo(listing.price_max_kobo)}`
                    : "—"}
              </p>
            </div>

            <p className="mt-4 text-xs text-muted-foreground">
              <Link href={`/p/${provider.slug}` as Route} className="underline">
                {provider.business_name}
              </Link>{" "}
              · {category.name}
            </p>
          </CardContent>
        </Card>

        <div className="mt-4 flex items-start gap-2 rounded-xl bg-muted p-4 text-sm text-foreground">
          <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" />
          Your payment is securely held by Nexa until your event is successfully completed.
        </div>

        <Card className="mt-4">
          <CardContent className="pt-6">
            <h2 className="text-sm font-medium">How payment works</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              There is no deposit, and nothing is deducted. Nexa holds your money from the moment you pay.
            </p>
            <ol className="mt-3 space-y-2 text-sm">
              <li className="flex gap-3">
                <span className="shrink-0 font-medium tabular-nums">1.</span>
                <span>You pay. Nexa holds the whole amount — the vendor gets nothing yet.</span>
              </li>
              <li className="flex gap-3">
                <span className="shrink-0 font-medium tabular-nums">2.</span>
                <span>The job is done and you are happy, so you give the vendor your completion code.</span>
              </li>
              <li className="flex gap-3">
                <span className="shrink-0 font-medium tabular-nums">3.</span>
                <span>Nexa pays the vendor.</span>
              </li>
            </ol>
          </CardContent>
        </Card>

        {/* Two ways to act, on every listing: talk to them, or book them. */}
        <div className="mt-6 space-y-3">
          {isFixed ? (
            <Link href={session ? bookPath : loginToBookPath} className="block">
              <Button className="w-full">Book this</Button>
            </Link>
          ) : (
            <p className="rounded-xl border border-dashed p-4 text-center text-xs text-muted-foreground">
              This vendor prices this job on request. Chat, agree a number, and the booking is created once you
              accept their offer.
            </p>
          )}

          <ChatOnWhatsApp listingId={listing.id} signedIn={Boolean(session)} next={listingPath} />
          <PrivacyNote />
        </div>
      </div>
    </div>
  );
}

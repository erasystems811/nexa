import Link from "next/link";
import type { Route } from "next";
import { notFound } from "next/navigation";
// See the same note in app/p/[slug]/page.tsx - api-client is always live,
// the local @/modules/marketplace module can lag an Admin change by up to 60s.
import { getListingBySlug } from "@nexa/api-client";
import { getSession } from "@/modules/auth";
import { formatKobo } from "@/lib/money";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ChatOnWhatsApp } from "@/components/chat-cta";
import { ListingGallery } from "@/components/listing-gallery";
import { ShieldCheck } from "lucide-react";
import { BackButton } from "@/components/back-button";

/** Listing page. */
export default async function ListingPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const listing = await getListingBySlug(slug);
  if (!listing) notFound();

  const session = await getSession();
  const category = listing.categories;
  const provider = listing.providers;
  // Both are non-nullable in practice (FK constraints), the API type is just
  // conservative about the join — this satisfies the type and doubles as a
  // sane fallback if the data is ever actually inconsistent.
  if (!category || !provider) notFound();
  const isFixed = listing.price_type === "fixed";
  // Self-serve vendors (e.g. food/ice-cream sellers invited to sell directly
  // to guests) are never booked or paid through Nexa — see VENDOR_TIERS.
  const isSelfServe = category.vendor_tier === "self_serve";

  // Every photo the vendor uploaded for this listing, not just the first -
  // falling back to the provider's own banner only when they haven't
  // uploaded any listing photo at all.
  const photos = listing.photos.length > 0 ? listing.photos : provider.cover_url ? [provider.cover_url] : [];
  const listingPath = `/l/${listing.slug}`;
  const bookPath = `/book/${listing.id}` as Route;
  const loginToBookPath = `/login?next=${encodeURIComponent(bookPath)}` as Route;

  return (
    <div className="max-w-2xl pb-8">
      <BackButton fallbackHref="/search" label="Back to services" />
      <ListingGallery photos={photos} alt={listing.title} />

      <div className="pt-5">
        <h1 className="font-serif text-3xl font-bold text-primary">{listing.title}</h1>
        {listing.description ? <p className="mt-1 text-sm text-muted-foreground">{listing.description}</p> : null}

        <Card className="mt-4">
          <CardContent className="pt-6">
            <div className="flex items-baseline justify-between">
              <p className="text-sm text-muted-foreground">
                {isSelfServe ? "Typical price" : isFixed ? "Price" : "Price on request"}
              </p>
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

        {isSelfServe ? (
          <div className="mt-4 flex items-start gap-2 rounded-xl bg-muted p-4 text-sm text-foreground">
            <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" />
            This vendor sells directly to your guests at the event — you don&rsquo;t pay Nexa or the vendor
            anything to invite them.
          </div>
        ) : (
          <>
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
          </>
        )}

        {/* Self-serve: the only way to act is to invite them — see VENDOR_TIERS. */}
        <div className="mt-6 space-y-3">
          {isSelfServe ? null : isFixed ? (
            <Link href={session ? bookPath : loginToBookPath} className="block">
              <Button className="w-full">Book this</Button>
            </Link>
          ) : (
            <p className="rounded-xl border border-dashed p-4 text-center text-xs text-muted-foreground">
              This vendor prices this job on request. Chat, agree a number, and the booking is created once you
              accept their offer.
            </p>
          )}

          <ChatOnWhatsApp
            listingId={listing.id}
            signedIn={Boolean(session)}
            next={listingPath}
            variant={isSelfServe ? "default" : "outline"}
            label={isSelfServe ? "Invite to your event" : "Chat on WhatsApp"}
          />
        </div>
      </div>
    </div>
  );
}

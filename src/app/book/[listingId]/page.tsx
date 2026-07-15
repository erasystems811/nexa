import type { Route } from "next";
import { notFound } from "next/navigation";
import { requireSession } from "@/modules/auth";
import { createClient } from "@/lib/supabase/server";
import { formatKobo } from "@/lib/money";
import { Card, PageHeader } from "@/components/ui";
import { BackBar } from "@/components/back-bar";
import { BookingForm } from "./booking-form";

/** Date/time, confirm, pay.: vendors own ordinary fulfillment. */
export default async function BookPage({ params }: { params: Promise<{ listingId: string }> }) {
  const { listingId } = await params;
  const { userId } = await requireSession();

  const supabase = await createClient();
  const { data: listing } = await supabase
    .from("listings")
    .select(
      `id, slug, title, price_kobo, price_type, payment_type,
       categories ( name, fulfillment_type ),
       providers ( business_name )`,
    )
    .eq("id", listingId)
    .eq("status", "approved")
    .maybeSingle();

  if (!listing) notFound();

  let priceKobo = listing.price_kobo ?? 0;
  if (listing.price_type === "negotiable") {
    const { data: offer } = await supabase
      .from("price_offers")
      .select("amount_kobo")
      .eq("listing_id", listing.id)
      .eq("customer_id", userId)
      .eq("status", "accepted")
      .maybeSingle();

    if (!offer) notFound();
    priceKobo = offer.amount_kobo;
  }

  const total = priceKobo;

  return (
    <main className="mx-auto max-w-2xl px-5 py-8">
      <BackBar fallback={`/l/${listing.slug}` as Route} className="mb-4" />
      <PageHeader title={listing.title} subtitle={listing.providers.business_name} />

      <Card>
        <dl className="space-y-2 text-sm">
          <div className="flex justify-between">
            <dt className="text-[color:var(--color-ink-muted)]">
              {listing.price_type === "negotiable" ? "Agreed price" : "Price"}
            </dt>
            <dd className="tabular-nums">{formatKobo(priceKobo)}</dd>
          </div>
          <div className="flex justify-between border-t border-[color:var(--color-line)] pt-2 font-medium">
            <dt>Total</dt>
            <dd className="tabular-nums">{formatKobo(total)}</dd>
          </div>
        </dl>

        <p className="mt-4 text-xs leading-relaxed text-[color:var(--color-ink-muted)]">
          After payment, Nexa helps keep the booking details organized until the service is completed.
        </p>
      </Card>

      <div className="mt-6">
        <BookingForm listingId={listing.id} />
      </div>
    </main>
  );
}

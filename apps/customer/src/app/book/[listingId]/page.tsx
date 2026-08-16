import Link from "next/link";
import type { Route } from "next";
import { notFound } from "next/navigation";
import { requireSession } from "@/modules/auth";
import { createClient } from "@/lib/supabase/server";
import { formatKobo } from "@/lib/money";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ShieldCheck, ArrowLeft } from "lucide-react";
import { BookingForm } from "./booking-form";

/** Date/time, confirm, pay. Vendors own ordinary fulfillment. */
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
    <main className="mx-auto min-h-dvh max-w-lg px-5 py-10">
      <Link
        href={`/l/${listing.slug}` as Route}
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Back
      </Link>

      <h1 className="font-serif text-2xl font-bold text-primary">{listing.title}</h1>
      <p className="mt-1 text-sm text-muted-foreground">{listing.providers.business_name}</p>

      <Card className="mt-6">
        <CardHeader className="border-b bg-secondary/30">
          <CardTitle>Book this vendor</CardTitle>
          <CardDescription>Secure your date with escrow protection</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 pt-6">
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">{listing.price_type === "negotiable" ? "Agreed price" : "Price"}</dt>
              <dd className="tabular-nums">{formatKobo(priceKobo)}</dd>
            </div>
            <div className="flex justify-between border-t pt-2 font-medium">
              <dt>Total</dt>
              <dd className="tabular-nums">{formatKobo(total)}</dd>
            </div>
          </dl>

          <div className="flex items-start gap-2 rounded-lg bg-muted p-3 text-xs text-muted-foreground">
            <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" />
            Nexa holds your payment and only releases it to the vendor after your event is completed.
          </div>

          <BookingForm listingId={listing.id} />
        </CardContent>
      </Card>
    </main>
  );
}

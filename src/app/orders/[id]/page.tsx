import { notFound } from "next/navigation";
import { Calendar, MapPin, ShieldCheck } from "lucide-react";
import { requireSession } from "@/modules/auth";
import { getMyOrder } from "@/modules/bookings";
import { formatKobo } from "@/lib/money";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusPill } from "@/components/status-pill";
import { ResumePaymentButton } from "../resume-payment-button";

/**
 * Booking detail.
 *
 * The completion code is the point of this screen. It is the customer's, it is
 * the only thing that gets the vendor paid, and it is deliberately front and
 * centre rather than buried. No RLS policy shows it to the vendor.
 */
export default async function OrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireSession();

  const result = await getMyOrder(id);
  if (!result) notFound();

  const { booking, codes } = result;
  const code = codes[0] ?? null;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h1 className="mb-1 font-serif text-3xl font-bold text-primary">{booking.listings.title}</h1>
          <p className="text-muted-foreground">{booking.providers.business_name}</p>
        </div>
        <div className="flex items-center gap-3">
          <StatusPill status={booking.status} />
          <span className="font-mono text-xs text-muted-foreground">{booking.reference}</span>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <div className="space-y-6 md:col-span-2">
          {booking.status === "pending" ? (
            <Card className="border-accent">
              <CardContent className="p-6">
                <h2 className="font-semibold">This booking is not paid yet</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Nothing is held and the vendor has not been notified until you pay. Finish now
                  to lock it in.
                </p>
                <div className="mt-4">
                  <ResumePaymentButton bookingId={booking.id} />
                </div>
              </CardContent>
            </Card>
          ) : null}

          {code ? (
            <Card className="relative overflow-hidden border-primary ring-2 ring-primary/20">
              <div className="pointer-events-none absolute right-0 top-0 p-6 opacity-5">
                <ShieldCheck className="h-32 w-32" />
              </div>
              <CardContent className="p-8">
                <div className="flex items-start gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                    <ShieldCheck className="h-6 w-6" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="mb-2 text-2xl font-bold">Your completion code</h3>
                    <p className="mb-6 text-muted-foreground">
                      Only you can see this. Give it to the vendor when the job is done and you
                      are happy — that is what tells Nexa to pay them. Never share it beforehand.
                    </p>
                    <div className="rounded-xl border border-secondary bg-secondary/50 p-6 text-center">
                      {code.consumed_at ? (
                        <p className="mb-2 text-xs font-medium text-emerald-700">Used</p>
                      ) : null}
                      <div
                        className={`font-mono text-4xl font-bold tracking-[0.4em] ${
                          code.consumed_at ? "text-muted-foreground line-through" : "text-primary"
                        }`}
                      >
                        {code.code}
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : null}

          <Card>
            <CardHeader className="border-b border-border bg-muted/30">
              <CardTitle>Progress</CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <ol className="space-y-3 text-sm">
                <Step done={!!booking.accepted_at} label="Vendor accepted the booking" />
                <Step
                  done={booking.status === "in_progress" || !!booking.completed_at}
                  label="Work under way"
                />
                <Step done={!!booking.completed_at} label="You gave the vendor your completion code" />
              </ol>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader className="border-b border-border bg-muted/30">
              <CardTitle>Payment</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 p-6 text-sm">
              <Row label="Price" value={formatKobo(booking.agreed_price_kobo)} />
              <div className="flex justify-between border-t border-border pt-3 font-bold">
                <dt>Held by Nexa</dt>
                <dd className="tabular-nums">{formatKobo(booking.agreed_price_kobo)}</dd>
              </div>
              <p className="text-xs text-muted-foreground">
                Nexa is holding the whole amount. The vendor gets nothing up front. Nexa pays them
                once the job is done — which is what your completion code says.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="border-b border-border bg-muted/30">
              <CardTitle>Event details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 p-6 text-sm">
              <div>
                <div className="mb-1 text-muted-foreground">Date</div>
                <div className="flex items-center gap-2 font-medium">
                  <Calendar className="h-4 w-4 text-primary" />
                  {new Date(booking.scheduled_start).toLocaleString("en-NG")}
                </div>
              </div>
              {booking.address ? (
                <div className="border-t border-border pt-4">
                  <div className="mb-1 text-muted-foreground">Location</div>
                  <div className="flex items-center gap-2 font-medium">
                    <MapPin className="h-4 w-4 text-primary" />
                    {booking.address}
                  </div>
                </div>
              ) : null}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Step({ done, label }: { done: boolean; label: string }) {
  return (
    <li className="flex items-start gap-3">
      <span
        className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] ${done ? "bg-primary text-primary-foreground" : "border border-border"}`}
      >
        {done ? "✓" : ""}
      </span>
      <span className={done ? "" : "text-muted-foreground"}>{label}</span>
    </li>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="tabular-nums">{value}</dd>
    </div>
  );
}

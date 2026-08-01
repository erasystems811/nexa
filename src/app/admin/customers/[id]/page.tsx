import { notFound } from "next/navigation";
import { requireView, PERMISSIONS as P } from "@/modules/admin";
import { getCustomerDetail } from "@/modules/admin";
import { formatKobo } from "@/lib/money";
import { Card, CardContent } from "@/components/ui/card";

export default async function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireView(P.customersView);
  const d = await getCustomerDetail(id);
  if (!d) notFound();

  const { profile, bookings, disputes } = d;

  return (
    <>
      <h1 className="font-serif text-2xl font-bold">{profile.full_name ?? "Customer"}</h1>
      {profile.phone ? <p className="mt-1 text-sm text-muted-foreground">{profile.phone}</p> : null}

      <Card className="mt-6">
        <CardContent className="pt-6">
          <h2 className="text-sm font-semibold">Booking history ({bookings.length})</h2>
          <ul className="mt-2 space-y-1 text-sm">
            {bookings.map((b) => (
              <li key={b.id} className="flex justify-between">
                <span>
                  {(b.providers as unknown as { business_name: string } | null)?.business_name} · {b.status}
                </span>
                <span className="tabular-nums text-muted-foreground">{formatKobo(b.agreed_price_kobo)}</span>
              </li>
            ))}
            {bookings.length === 0 ? <li className="text-muted-foreground">No bookings.</li> : null}
          </ul>
        </CardContent>
      </Card>

      {disputes.length > 0 ? (
        <Card className="mt-3">
          <CardContent className="pt-6">
            <h2 className="text-sm font-semibold">Complaints &amp; disputes</h2>
            <ul className="mt-2 space-y-1 text-sm">
              {disputes.map((dp) => (
                <li key={dp.id} className="flex justify-between">
                  <span>{dp.reason}</span>
                  <span className="text-muted-foreground">{dp.status}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}
    </>
  );
}

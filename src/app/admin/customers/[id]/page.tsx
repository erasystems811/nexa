import { notFound } from "next/navigation";
import { requireView, PERMISSIONS as P } from "@/modules/admin";
import { getCustomerDetail } from "@/modules/admin";
import { formatKobo } from "@/lib/money";
import { Card, PageHeader } from "@/components/ui";
import { AdminBack } from "@/components/admin-back";

export default async function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireView(P.customersView);
  const d = await getCustomerDetail(id);
  if (!d) notFound();

  const { profile, bookings, disputes } = d;

  return (
    <>
      <AdminBack fallback="/customers" />
      <PageHeader title={profile.full_name ?? "Customer"} subtitle={profile.phone ?? undefined} />

      <Card>
        <h2 className="text-sm font-semibold">Booking history ({bookings.length})</h2>
        <ul className="mt-2 space-y-1 text-sm">
          {bookings.map((b) => (
            <li key={b.id} className="flex justify-between">
              <span>
                {(b.providers as unknown as { business_name: string } | null)?.business_name} · {b.status}
              </span>
              <span className="tabular-nums text-[color:var(--color-ink-muted)]">{formatKobo(b.agreed_price_kobo)}</span>
            </li>
          ))}
          {bookings.length === 0 ? <li className="text-[color:var(--color-ink-muted)]">No bookings.</li> : null}
        </ul>
      </Card>

      {disputes.length > 0 ? (
        <Card className="mt-3">
          <h2 className="text-sm font-semibold">Complaints & disputes</h2>
          <ul className="mt-2 space-y-1 text-sm">
            {disputes.map((dp) => (
              <li key={dp.id} className="flex justify-between">
                <span>{dp.reason}</span>
                <span className="text-[color:var(--color-ink-muted)]">{dp.status}</span>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
    </>
  );
}

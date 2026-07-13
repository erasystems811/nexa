import { requireView, PERMISSIONS as P } from "@/modules/admin";
import { listDisputes } from "@/modules/admin";
import { Card, PageHeader } from "@/components/ui";
import { DisputeActions } from "./dispute-actions";

/** Disputes queue. Includes caution-fee damage claims. */
export default async function DisputesPage() {
  await requireView(P.disputesView);
  const disputes = await listDisputes();

  return (
    <>
      <PageHeader title="Disputes" subtitle="Booking disputes and damage claims, resolved by hand." />

      {disputes.length === 0 ? (
        <Card className="text-sm text-[color:var(--color-ink-muted)]">Nothing open.</Card>
      ) : (
        <ul className="space-y-3">
          {disputes.map((dp) => {
            const booking = dp.bookings as unknown as { reference: string; providers: { business_name: string } | null } | null;
            return (
              <li key={dp.id}>
                <Card>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium">{dp.reason}</p>
                      <p className="mt-0.5 text-xs text-[color:var(--color-ink-muted)]">
                        {booking?.reference} · {booking?.providers?.business_name ?? "—"}
                      </p>
                    </div>
                  </div>
                  <DisputeActions disputeId={dp.id} />
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}

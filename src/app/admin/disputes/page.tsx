import { requireRole } from "@/modules/auth";
import { listDisputes } from "@/modules/admin";
import { formatKobo } from "@/lib/money";
import { Card, PageHeader } from "@/components/ui";
import { DisputeActions } from "./dispute-actions";

/** Disputes queue. PRD Sections 10, 12. Includes caution-fee damage claims. */
export default async function DisputesPage() {
  await requireRole("admin");
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
                    {dp.is_damage_claim ? (
                      <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-medium text-amber-900">
                        Damage claim {dp.caution_claim_kobo ? formatKobo(dp.caution_claim_kobo) : ""}
                      </span>
                    ) : null}
                  </div>
                  <DisputeActions
                    disputeId={dp.id}
                    bookingId={(dp.bookings as unknown as { id?: string })?.id ?? ""}
                    isDamageClaim={dp.is_damage_claim}
                    cautionKobo={dp.caution_claim_kobo ?? 0}
                  />
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}

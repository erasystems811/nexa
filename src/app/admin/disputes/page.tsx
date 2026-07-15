import { requireView, PERMISSIONS as P } from "@/modules/admin";
import { listDisputes } from "@/modules/admin";
import { Card, PageHeader } from "@/components/ui";
import { DisputeActions } from "./dispute-actions";

const REASON_LABEL: Record<string, string> = {
  vendor_no_code: "Vendor says the customer won't give the code",
};

/**
 * Disputes.
 *
 * The common one: a vendor did the job, the customer will not hand over their
 * completion code, so the money is stuck. Nexa reads the vendor's account, can
 * reach the customer (their number is right here), and decides — pay the vendor
 * without a code, or refund the customer if the job was not done.
 */
export default async function DisputesPage() {
  await requireView(P.disputesView);
  const disputes = await listDisputes();

  return (
    <>
      <PageHeader
        title="Disputes"
        subtitle="A booking where the money is stuck. You decide where it goes."
      />

      {disputes.length === 0 ? (
        <Card className="text-sm text-[color:var(--color-ink-muted)]">Nothing open.</Card>
      ) : (
        <ul className="space-y-3">
          {disputes.map((dp) => {
            const booking = dp.bookings as unknown as {
              id: string;
              reference: string;
              providers: { business_name: string } | null;
              profiles: { full_name: string | null; phone: string | null } | null;
            } | null;
            return (
              <li key={dp.id}>
                <Card>
                  <p className="text-sm font-medium">
                    {REASON_LABEL[dp.reason] ?? dp.reason}
                  </p>
                  <p className="mt-0.5 text-xs text-[color:var(--color-ink-muted)]">
                    {booking?.reference} · vendor: {booking?.providers?.business_name ?? "—"}
                  </p>

                  {dp.description ? (
                    <p className="mt-3 rounded-lg bg-[color:var(--color-surface-sunk)] px-3 py-2 text-sm">
                      &ldquo;{dp.description}&rdquo;
                    </p>
                  ) : null}

                  <p className="mt-3 text-xs text-[color:var(--color-ink-muted)]">
                    Customer: {booking?.profiles?.full_name ?? "—"}
                    {booking?.profiles?.phone ? (
                      <>
                        {" · "}
                        <a href={`tel:${booking.profiles.phone}`} className="underline">
                          {booking.profiles.phone}
                        </a>{" "}
                        (call them for the code first)
                      </>
                    ) : null}
                  </p>

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

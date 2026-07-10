import { notFound } from "next/navigation";
import { requireSession } from "@/modules/auth";
import { requireApprovedRider, getAssignment } from "@/modules/rider";
import { formatKobo } from "@/lib/money";
import { Card, PageHeader } from "@/components/ui";
import { DeliveryFlow } from "./delivery-flow";

/** One delivery, with the step-by-step flow. PRD Section 15. */
export default async function AssignmentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireSession();
  const rider = await requireApprovedRider();

  const a = await getAssignment(rider.id, id);
  if (!a) notFound();

  const b = a.bookings;
  const isReturn = a.leg === 2;

  return (
    <main className="mx-auto max-w-md px-5 py-8">
      <PageHeader
        title={b.listings.title}
        subtitle={`${isReturn ? "Return pickup" : "Delivery"} · ${formatKobo(a.fee_share_kobo)}`}
      />

      <Card>
        <dl className="space-y-3 text-sm">
          <div>
            <dt className="text-xs uppercase tracking-wider text-[color:var(--color-ink-muted)]">
              {isReturn ? "Collect from (customer)" : "Pick up from (provider)"}
            </dt>
            <dd className="mt-0.5">
              {isReturn ? (b.address ?? "Customer address") : (b.providers.address ?? b.providers.business_name)}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wider text-[color:var(--color-ink-muted)]">
              {isReturn ? "Return to (provider)" : "Drop off to (customer)"}
            </dt>
            <dd className="mt-0.5">
              {isReturn ? (b.providers.address ?? b.providers.business_name) : (b.address ?? "Customer address")}
            </dd>
          </div>
          {b.notes ? (
            <div>
              <dt className="text-xs uppercase tracking-wider text-[color:var(--color-ink-muted)]">Notes</dt>
              <dd className="mt-0.5">{b.notes}</dd>
            </div>
          ) : null}
          <div>
            <dt className="text-xs uppercase tracking-wider text-[color:var(--color-ink-muted)]">When</dt>
            <dd className="mt-0.5">{new Date(b.scheduled_start).toLocaleString("en-NG")}</dd>
          </div>
        </dl>
      </Card>

      <div className="mt-6">
        <DeliveryFlow
          assignmentId={a.id}
          status={a.status}
          isReturn={isReturn}
        />
      </div>
    </main>
  );
}

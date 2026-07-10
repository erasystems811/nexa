import { notFound } from "next/navigation";
import { requireView, PERMISSIONS as P } from "@/modules/admin";
import { getRiderDetail } from "@/modules/admin";
import { suspendRiderAction, verifyRiderAction } from "@/modules/admin/actions";
import { formatKobo } from "@/lib/money";
import { Card, PageHeader } from "@/components/ui";
import { ActionButton } from "../../action-button";

export default async function RiderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireView(P.ridersView);
  const d = await getRiderDetail(id);
  if (!d) notFound();

  const { rider, reliability, wallet, documents, assignments } = d;

  return (
    <>
      <PageHeader title={rider.full_name} subtitle={`${rider.vehicle_type} · ${rider.status}`} />

      <div className="mb-4 flex flex-wrap gap-2">
        {rider.status === "pending" ? (
          <>
            <ActionButton label="Verify & approve" variant="primary" confirm="Approve this rider and their documents?" run={() => verifyRiderAction(rider.id, true)} />
            <ActionButton label="Reject" variant="danger" prompt="Reason:" run={(r) => verifyRiderAction(rider.id, false, r)} />
          </>
        ) : null}
        {rider.status === "approved" ? <ActionButton label="Suspend" variant="danger" confirm="Suspend this rider?" run={() => suspendRiderAction(rider.id, true)} /> : null}
        {rider.status === "suspended" ? <ActionButton label="Reinstate" variant="primary" run={() => suspendRiderAction(rider.id, false)} /> : null}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Card>
          <h2 className="text-sm font-semibold">Details</h2>
          <dl className="mt-2 space-y-1 text-sm">
            <Row k="Phone" v={rider.phone} />
            <Row k="Vehicle" v={`${rider.vehicle_type}${rider.vehicle_plate ? ` (${rider.vehicle_plate})` : ""}`} />
            <Row k="On-time" v={reliability ? `${reliability.on_time_rate}%` : "—"} />
            <Row k="Completed" v={String(reliability?.completed_deliveries ?? 0)} />
          </dl>
        </Card>
        <Card>
          <h2 className="text-sm font-semibold">Wallet</h2>
          <dl className="mt-2 space-y-1 text-sm">
            <Row k="Available" v={formatKobo(wallet?.available_kobo ?? 0)} />
            <Row k="Pending" v={formatKobo(wallet?.pending_kobo ?? 0)} />
            <Row k="Withdrawn" v={formatKobo(wallet?.withdrawn_kobo ?? 0)} />
          </dl>
        </Card>
      </div>

      <Card className="mt-3">
        <h2 className="text-sm font-semibold">Documents</h2>
        {documents.length === 0 ? (
          <p className="mt-1 text-sm text-[color:var(--color-ink-muted)]">None uploaded.</p>
        ) : (
          <ul className="mt-2 space-y-1 text-sm">
            {documents.map((doc) => (
              <li key={doc.id} className="flex justify-between">
                <span>{doc.kind}</span>
                <span className="text-[color:var(--color-ink-muted)]">{doc.status}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="mt-3">
        <h2 className="text-sm font-semibold">Delivery history ({assignments.length})</h2>
        <ul className="mt-2 space-y-1 text-sm">
          {assignments.map((a) => (
            <li key={a.id} className="flex justify-between">
              <span className="font-mono text-xs">
                {(a.bookings as unknown as { reference: string } | null)?.reference ?? "—"} · leg {a.leg}
              </span>
              <span className="text-[color:var(--color-ink-muted)]">{a.status}</span>
            </li>
          ))}
        </ul>
      </Card>
    </>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between">
      <dt className="text-[color:var(--color-ink-muted)]">{k}</dt>
      <dd>{v}</dd>
    </div>
  );
}

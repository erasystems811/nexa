import { notFound } from "next/navigation";
import { requireView, PERMISSIONS as P } from "@/modules/admin";
import { getOrderDetail } from "@/modules/admin";
import { noShowAction } from "@/modules/admin/actions";
import { formatKobo } from "@/lib/money";
import { Card, PageHeader } from "@/components/ui";
import { StatusPill } from "@/components/status-pill";
import { ActionButton } from "../../action-button";
import { OrderInterventions } from "./interventions";

const KIND: Record<string, string> = {
  hold: "Held from customer",
  stage_release: "Paid to vendor",
  commission: "Nexa commission",
  penalty: "Late penalty",
  refund: "Refunded to customer",
};

export default async function AdminOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireView(P.ordersView);
  const d = await getOrderDetail(id);
  if (!d) notFound();

  const { booking, payment, codes, ledger } = d;

  return (
    <>
      <PageHeader
        title={booking.reference}
        subtitle={`${(booking.listings as unknown as { title: string } | null)?.title} · ${(booking.providers as unknown as { business_name: string } | null)?.business_name}`}
      />

      <div className="mb-4 flex items-center gap-2">
        <StatusPill status={booking.status} />
        {["paid_held", "accepted", "in_progress"].includes(booking.status) ? (
          <ActionButton label="Record no-show" variant="danger" confirm="Record a no-show? The provider is suspended pending appeal and the booking is refunded." run={noShowAction.bind(null, booking.id)} />
        ) : null}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Card>
          <h2 className="text-sm font-semibold">Booking</h2>
          <dl className="mt-2 space-y-1 text-sm">
            <Row k="Customer" v={(booking.profiles as unknown as { full_name: string | null } | null)?.full_name ?? "—"} />
            <Row k="When" v={new Date(booking.scheduled_start).toLocaleString("en-NG")} />
            <Row k="Fulfillment" v={booking.fulfillment_type.replace(/_/g, " ")} />
            <Row k="Price" v={formatKobo(booking.agreed_price_kobo)} />
          </dl>
        </Card>
        <Card>
          <h2 className="text-sm font-semibold">Payment</h2>
          {payment ? (
            <dl className="mt-2 space-y-1 text-sm">
              <Row k="Status" v={payment.status} />
              <Row k="Held" v={formatKobo(payment.held_kobo)} />
              <Row k="Released" v={formatKobo(payment.released_kobo)} />
              <Row k="Commission" v={formatKobo(payment.commission_kobo)} />
              {payment.penalty_kobo > 0 ? <Row k="Penalty" v={formatKobo(payment.penalty_kobo)} /> : null}
            </dl>
          ) : (
            <p className="mt-1 text-sm text-[color:var(--color-ink-muted)]">No payment.</p>
          )}
        </Card>
      </div>

      {codes.length > 0 ? (
        <Card className="mt-3">
          <h2 className="text-sm font-semibold">Confirmation codes</h2>
          <ul className="mt-2 space-y-1 text-sm">
            {codes.map((c) => (
              <li key={c.stage} className="flex justify-between font-mono">
                <span>Stage {c.stage}</span>
                <span className={c.consumed_at ? "text-[color:var(--color-ink-muted)] line-through" : ""}>{c.code}</span>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      <OrderInterventions bookingId={booking.id} />

      {ledger.length > 0 ? (
        <Card className="mt-3">
          <h2 className="text-sm font-semibold">Money trail</h2>
          <ul className="mt-2 space-y-1 text-sm">
            {ledger.map((l, i) => (
              <li key={i} className="flex justify-between">
                <span className="text-[color:var(--color-ink-muted)]">{KIND[l.kind] ?? l.kind}{l.stage ? ` (stage ${l.stage})` : ""}</span>
                <span className={`tabular-nums ${l.amount_kobo < 0 ? "text-[color:var(--color-danger)]" : ""}`}>{formatKobo(l.amount_kobo)}</span>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
    </>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="shrink-0 text-[color:var(--color-ink-muted)]">{k}</dt>
      <dd className="text-right">{v}</dd>
    </div>
  );
}

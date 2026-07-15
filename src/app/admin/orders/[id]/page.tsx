import { notFound } from "next/navigation";
import { requireView, currentStaff, can, getOrderDetail, PERMISSIONS as P } from "@/modules/admin";
import { noShowAction } from "@/modules/admin/actions";
import { formatKobo } from "@/lib/money";
import { getNumericSetting, SETTINGS } from "@/modules/settings";
import { Card, PageHeader } from "@/components/ui";
import { StatusPill } from "@/components/status-pill";
import { ActionButton } from "../../action-button";
import { PayVendor, RefundCustomer, ChangeStatus } from "./pay-vendor";

/** Plain names for every movement of money on this booking. */
const MOVE: Record<string, string> = {
  hold: "Paid by the customer, held by Nexa",
  stage_release: "Paid to the vendor",
  refund: "Sent back to the customer",
};

export default async function AdminOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireView(P.ordersView);
  const staff = await currentStaff();
  const [d, commissionPercent] = await Promise.all([
    getOrderDetail(id),
    getNumericSetting(SETTINGS.commissionPercent),
  ]);
  if (!d) notFound();

  const { booking, money, codes, ledger } = d;
  const holding = money && money.isPaid && money.stillHeldKobo > 0;

  return (
    <>
      <PageHeader
        title={booking.reference}
        subtitle={`${(booking.listings as unknown as { title: string } | null)?.title} · ${(booking.providers as unknown as { business_name: string } | null)?.business_name}`}
      />

      <div className="mb-4 flex items-center gap-2">
        <StatusPill status={booking.status} />
        {["paid_held", "accepted", "in_progress"].includes(booking.status) ? (
          <ActionButton
            label="Vendor never showed up"
            variant="danger"
            confirm="Record a no-show? The vendor is suspended pending appeal and the customer is refunded."
            run={noShowAction.bind(null, booking.id)}
          />
        ) : null}
      </div>

      {/* The money, first and biggest — it is why an admin opens this page. */}
      {money ? (
        <Card>
          <h2 className="text-sm font-semibold">The money on this booking</h2>
          <dl className="mt-3 space-y-2 text-sm">
            <Row k="The customer paid" v={formatKobo(money.customerPaidKobo)} />
            <Row k="Paid to the vendor so far" v={formatKobo(money.paidToVendorKobo)} />
            {money.refundedKobo > 0 ? (
              <Row k="Sent back to the customer" v={formatKobo(money.refundedKobo)} />
            ) : null}
            <div className="flex items-baseline justify-between gap-3 border-t border-[color:var(--color-line)] pt-2">
              <dt className="text-sm font-semibold">Nexa is still holding</dt>
              <dd className="text-xl font-semibold tabular-nums">{formatKobo(money.stillHeldKobo)}</dd>
            </div>
          </dl>
          {!money.isPaid ? (
            <p className="mt-2 text-xs text-[color:var(--color-ink-muted)]">
              The customer has not paid yet — nothing is held.
            </p>
          ) : null}
        </Card>
      ) : (
        <Card className="text-sm text-[color:var(--color-ink-muted)]">
          No money has been taken for this booking.
        </Card>
      )}

      {holding && can(staff, P.paymentsPayout) ? (
        <PayVendor
          bookingId={booking.id}
          vendorPayKobo={money.vendorPayKobo}
          nexaCommissionKobo={money.nexaCommissionKobo}
          stillOwedVendorKobo={money.stillOwedVendorKobo}
          commissionPercent={commissionPercent}
        />
      ) : null}
      {holding && can(staff, P.paymentsRefund) ? (
        <RefundCustomer bookingId={booking.id} stillHeldKobo={money.stillHeldKobo} />
      ) : null}

      <Card className="mt-3">
        <h2 className="text-sm font-semibold">Booking</h2>
        <dl className="mt-2 space-y-1 text-sm">
          <Row
            k="Customer"
            v={(booking.profiles as unknown as { full_name: string | null } | null)?.full_name ?? "—"}
          />
          <Row k="When" v={new Date(booking.scheduled_start).toLocaleString("en-NG")} />
          <Row k="Agreed price" v={formatKobo(booking.agreed_price_kobo)} />
          {codes.length > 0 ? (
            <Row
              k="Customer's confirmation code"
              v={codes.map((c) => (c.consumed_at ? `${c.code} (used)` : c.code)).join(" · ")}
            />
          ) : null}
        </dl>
      </Card>

      {ledger.length > 0 ? (
        <Card className="mt-3">
          <h2 className="text-sm font-semibold">What has happened to the money</h2>
          <ul className="mt-2 space-y-1 text-sm">
            {ledger.map((l, i) => (
              <li key={i} className="flex justify-between gap-3">
                <span className="text-[color:var(--color-ink-muted)]">{MOVE[l.kind] ?? l.kind}</span>
                <span className={`shrink-0 tabular-nums ${l.amount_kobo < 0 ? "text-[color:var(--color-danger)]" : ""}`}>
                  {formatKobo(l.amount_kobo)}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      {can(staff, P.ordersOverride) ? <ChangeStatus bookingId={booking.id} /> : null}
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

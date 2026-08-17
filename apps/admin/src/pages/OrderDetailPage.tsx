import { useState, type FormEvent } from "react";
import { useParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { formatKobo, koboToNaira, nairaToKobo } from "@nexa/money";
import type { BookingStatus } from "@nexa/db-types";
import { Card, CardContent } from "@nexa/design-system/src/components/ui/card";
import { Button } from "@nexa/design-system/src/components/ui/button";
import { Input } from "@nexa/design-system/src/components/ui/input";
import { Label } from "@nexa/design-system/src/components/ui/label";
import { StatusPill } from "../components/status-pill";
import { ActionButton } from "../components/action-button";
import { useAuth } from "../auth/AuthContext";
import { PERMISSIONS as P, can } from "../lib/permissions";
import { apiSend, ApiError } from "../lib/api";
import { useApiQuery } from "../lib/query";

/** Plain names for every movement of money on this booking. */
const MOVE: Record<string, string> = {
  hold: "Paid by the customer, held by Nexa",
  stage_release: "Paid to the vendor",
  refund: "Sent back to the customer",
};

interface BookingMoney {
  customerPaidKobo: number;
  paidToVendorKobo: number;
  refundedKobo: number;
  stillHeldKobo: number;
  vendorPayKobo: number;
  nexaCommissionKobo: number;
  stillOwedVendorKobo: number;
  isPaid: boolean;
}

interface BookingDetail {
  id: string;
  reference: string;
  status: BookingStatus;
  scheduled_start: string;
  agreed_price_kobo: number;
  listings: { title: string } | null;
  providers: { business_name: string } | null;
  profiles: { full_name: string | null } | null;
}

interface LedgerEntry {
  kind: string;
  amount_kobo: number;
  note: string | null;
  created_at: string;
}

interface ConfirmationCode {
  stage: number;
  code: string;
  consumed_at: string | null;
}

interface OrderDetail {
  booking: BookingDetail;
  payment: unknown;
  money: BookingMoney | null;
  commissionPercent: number;
  codes: ConfirmationCode[];
  ledger: LedgerEntry[];
}

/** Naira typed into a form -> kobo. A blank or nonsense amount is caught here. */
function nairaInputToKobo(raw: string): number {
  const trimmed = raw.trim();
  const naira = Number(trimmed);
  if (!trimmed || !Number.isFinite(naira)) throw new Error(`"${trimmed}" is not an amount`);
  return nairaToKobo(naira);
}

export function OrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { staff } = useAuth();
  const allowed = can(staff, P.ordersView);
  const queryClient = useQueryClient();
  const queryKey = ["order", id] as const;
  const { data: d, error } = useApiQuery<OrderDetail>(queryKey, `/admin/orders/${id}`, undefined, {
    enabled: Boolean(id) && allowed,
  });
  const notFound = error instanceof ApiError && error.status === 404;
  const reload = () => queryClient.invalidateQueries({ queryKey });

  if (!allowed) return <div className="text-muted-foreground">You don&rsquo;t have permission to view bookings.</div>;
  if (notFound) return <div className="text-muted-foreground">No such booking.</div>;
  if (!d) return <div className="text-muted-foreground">Loading…</div>;

  const { booking, money, codes, ledger, commissionPercent } = d;
  const holding = money !== null && money.isPaid && money.stillHeldKobo > 0;

  return (
    <>
      <h1 className="font-serif text-2xl font-bold">{booking.reference}</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {booking.listings?.title} · {booking.providers?.business_name}
      </p>

      <div className="mb-4 mt-4 flex items-center gap-2">
        <StatusPill status={booking.status} />
        {["paid_held", "accepted", "in_progress"].includes(booking.status) ? (
          <ActionButton
            label="Vendor never showed up"
            variant="danger"
            confirm="Record a no-show? The vendor is suspended pending appeal and the customer is refunded."
            run={async () => {
              await apiSend("POST", `/admin/orders/${booking.id}/no-show`);
              reload();
            }}
          />
        ) : null}
      </div>

      {/* The money, first and biggest — it is why an admin opens this page. */}
      {money ? (
        <Card>
          <CardContent className="pt-6">
            <h2 className="text-sm font-semibold">The money on this booking</h2>
            <dl className="mt-3 space-y-2 text-sm">
              <Row k="The customer paid" v={formatKobo(money.customerPaidKobo)} />
              <Row k="Paid to the vendor so far" v={formatKobo(money.paidToVendorKobo)} />
              {money.refundedKobo > 0 ? <Row k="Sent back to the customer" v={formatKobo(money.refundedKobo)} /> : null}
              <div className="flex items-baseline justify-between gap-3 border-t pt-2">
                <dt className="text-sm font-semibold">Nexa is still holding</dt>
                <dd className="text-xl font-semibold tabular-nums">{formatKobo(money.stillHeldKobo)}</dd>
              </div>
            </dl>
            {!money.isPaid ? <p className="mt-2 text-xs text-muted-foreground">The customer has not paid yet — nothing is held.</p> : null}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="pt-6 text-sm text-muted-foreground">No money has been taken for this booking.</CardContent>
        </Card>
      )}

      {holding && money && can(staff, P.paymentsPayout) ? (
        <PayVendor
          bookingId={booking.id}
          vendorPayKobo={money.vendorPayKobo}
          nexaCommissionKobo={money.nexaCommissionKobo}
          stillOwedVendorKobo={money.stillOwedVendorKobo}
          commissionPercent={commissionPercent}
          onDone={reload}
        />
      ) : null}
      {holding && money && can(staff, P.paymentsRefund) ? (
        <RefundCustomer bookingId={booking.id} stillHeldKobo={money.stillHeldKobo} onDone={reload} />
      ) : null}

      <Card className="mt-3">
        <CardContent className="pt-6">
          <h2 className="text-sm font-semibold">Booking</h2>
          <dl className="mt-2 space-y-1 text-sm">
            <Row k="Customer" v={booking.profiles?.full_name ?? "—"} />
            <Row k="When" v={new Date(booking.scheduled_start).toLocaleString("en-NG")} />
            <Row k="Agreed price" v={formatKobo(booking.agreed_price_kobo)} />
            {codes.length > 0 ? (
              <Row k="Customer's confirmation code" v={codes.map((c) => (c.consumed_at ? `${c.code} (used)` : c.code)).join(" · ")} />
            ) : null}
          </dl>
        </CardContent>
      </Card>

      {ledger.length > 0 ? (
        <Card className="mt-3">
          <CardContent className="pt-6">
            <h2 className="text-sm font-semibold">What has happened to the money</h2>
            <ul className="mt-2 space-y-1 text-sm">
              {ledger.map((l, i) => (
                <li key={i} className="flex justify-between gap-3">
                  <span className="text-muted-foreground">{MOVE[l.kind] ?? l.kind}</span>
                  <span className={`shrink-0 tabular-nums ${l.amount_kobo < 0 ? "text-destructive" : ""}`}>{formatKobo(l.amount_kobo)}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      {can(staff, P.ordersOverride) ? <ChangeStatus bookingId={booking.id} onDone={reload} /> : null}
    </>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="shrink-0 text-muted-foreground">{k}</dt>
      <dd className="text-right">{v}</dd>
    </div>
  );
}

/**
 * THE core admin job: Nexa is holding the customer's money, the job is done, and
 * a person decides how much of it the vendor gets. The amount starts at
 * everything still held and can only be lowered — the server refuses anything
 * above it, and this form will not even offer it.
 */
function PayVendor({
  bookingId,
  vendorPayKobo,
  nexaCommissionKobo,
  stillOwedVendorKobo,
  commissionPercent,
  onDone,
}: {
  bookingId: string;
  vendorPayKobo: number;
  nexaCommissionKobo: number;
  stillOwedVendorKobo: number;
  commissionPercent: number;
  onDone: () => void;
}) {
  const maxNaira = koboToNaira(stillOwedVendorKobo);
  const [naira, setNaira] = useState(String(Math.floor(maxNaira)));
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  const entered = Number(naira);
  const tooMuch = Number.isFinite(entered) && entered > maxNaira;
  const alreadyPaidKobo = vendorPayKobo - stillOwedVendorKobo;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setOk(false);
    setPending(true);
    try {
      const amountKobo = nairaInputToKobo(naira);
      await apiSend("POST", `/admin/orders/${bookingId}/pay-vendor`, { amountKobo });
      setOk(true);
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setPending(false);
    }
  }

  return (
    <Card className="mt-4 border-accent">
      <CardContent className="pt-6">
        <h2 className="text-base font-semibold">Pay the vendor</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          This vendor&rsquo;s pay on this booking is <strong className="text-foreground">{formatKobo(vendorPayKobo)}</strong>
          {commissionPercent > 0 ? (
            <>
              {" "}
              &mdash; the customer&rsquo;s payment less Nexa&rsquo;s {commissionPercent}% commission of{" "}
              <strong className="text-foreground">{formatKobo(nexaCommissionKobo)}</strong>, which Nexa keeps.
            </>
          ) : (
            "."
          )}
          {alreadyPaidKobo > 0 ? ` You have already sent them ${formatKobo(alreadyPaidKobo)}.` : ""}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Send everything that&rsquo;s left, or part of it as a deposit before the job is done. The commission is
          never part of this.
        </p>

        <form onSubmit={onSubmit} className="mt-4 flex flex-wrap items-end gap-3">
          <div>
            <Label htmlFor="pay-amount" className="text-xs">
              Amount to pay the vendor (₦)
            </Label>
            <Input
              id="pay-amount"
              name="amount"
              type="number"
              min="1"
              max={maxNaira}
              step="any"
              required
              value={naira}
              onChange={(e) => setNaira(e.target.value)}
              className="mt-1 h-11 w-48 tabular-nums"
            />
          </div>
          <Button type="submit" disabled={pending || tooMuch || entered <= 0}>
            {pending ? "Sending…" : "Release to vendor"}
          </Button>
        </form>

        {tooMuch ? (
          <p className="mt-2 text-xs text-destructive">
            The most you can pay this vendor now is {formatKobo(stillOwedVendorKobo)}. The rest is Nexa&rsquo;s commission.
          </p>
        ) : null}

        {error ? <p className="mt-3 text-sm text-destructive">{error}</p> : null}
        {ok ? <p className="mt-3 text-sm text-emerald-500">Sent to the vendor&rsquo;s bank account.</p> : null}
      </CardContent>
    </Card>
  );
}

/** Money back to the customer. Also capped at what Nexa is still holding. */
function RefundCustomer({ bookingId, stillHeldKobo, onDone }: { bookingId: string; stillHeldKobo: number; onDone: () => void }) {
  const [naira, setNaira] = useState("");
  const [reason, setReason] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setOk(false);
    setPending(true);
    try {
      const amountKobo = nairaInputToKobo(naira);
      await apiSend("POST", `/admin/orders/${bookingId}/refund`, { amountKobo, reason });
      setOk(true);
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setPending(false);
    }
  }

  return (
    <Card className="mt-3">
      <CardContent className="pt-6">
        <h2 className="text-sm font-semibold">Refund the customer</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Sends money back from what Nexa is holding — at most {formatKobo(stillHeldKobo)}.
        </p>
        <form onSubmit={onSubmit} className="mt-3 flex flex-wrap items-end gap-2">
          <div>
            <Label htmlFor="refund-amount" className="text-xs">
              Amount (₦)
            </Label>
            <Input
              id="refund-amount"
              name="amount"
              type="number"
              min="1"
              max={koboToNaira(stillHeldKobo)}
              step="any"
              required
              value={naira}
              onChange={(e) => setNaira(e.target.value)}
              className="mt-1 h-10 w-32 tabular-nums"
            />
          </div>
          <Input
            name="reason"
            placeholder="Why?"
            required
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="h-10 flex-1"
          />
          <Button type="submit" variant="outline" disabled={pending}>
            {pending ? "Refunding…" : "Refund"}
          </Button>
        </form>
        {error ? <p className="mt-2 text-sm text-destructive">{error}</p> : null}
        {ok ? <p className="mt-2 text-sm text-emerald-500">Sent back to the customer.</p> : null}
      </CardContent>
    </Card>
  );
}

const STATUSES = ["paid_held", "accepted", "in_progress", "completed", "cancelled", "disputed"];

/** A blunt instrument, kept out of the way. It moves no money. */
function ChangeStatus({ bookingId, onDone }: { bookingId: string; onDone: () => void }) {
  const [status, setStatus] = useState(STATUSES[0]);
  const [reason, setReason] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setOk(false);
    setPending(true);
    try {
      await apiSend("POST", `/admin/orders/${bookingId}/override`, { status, reason });
      setOk(true);
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setPending(false);
    }
  }

  return (
    <Card className="mt-3">
      <CardContent className="pt-6">
        <h2 className="text-sm font-semibold">Change the booking status by hand</h2>
        <p className="mt-1 text-xs text-muted-foreground">Only use this when something went wrong. It changes the booking, not the money.</p>
        <form onSubmit={onSubmit} className="mt-3 flex flex-wrap items-end gap-2">
          <select
            name="status"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="flex h-10 rounded-md border border-input bg-transparent px-3 text-sm outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s.replace(/_/g, " ")}
              </option>
            ))}
          </select>
          <Input name="reason" placeholder="Why?" required value={reason} onChange={(e) => setReason(e.target.value)} className="h-10 flex-1" />
          <Button type="submit" variant="outline" disabled={pending}>
            {pending ? "Changing…" : "Change"}
          </Button>
        </form>
        {error ? <p className="mt-2 text-sm text-destructive">{error}</p> : null}
        {ok ? <p className="mt-2 text-sm text-emerald-500">Changed.</p> : null}
      </CardContent>
    </Card>
  );
}

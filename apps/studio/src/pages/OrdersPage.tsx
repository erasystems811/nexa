import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { formatKobo } from "@nexa/money";
import { Card, CardContent } from "@nexa/design-system/src/components/ui/card";
import { Button } from "@nexa/design-system/src/components/ui/button";
import { Input } from "@nexa/design-system/src/components/ui/input";
import { Textarea } from "@nexa/design-system/src/components/ui/textarea";
import type { BookingStatus } from "@nexa/db-types/src/types";
import { StatusPill } from "../components/status-pill";
import { apiSend, ApiError } from "../lib/api";
import { useApiQuery } from "../lib/query";

const STATUSES = ["paid_held", "accepted", "in_progress", "completed", "cancelled", "disputed"] as const;

interface Order {
  id: string;
  reference: string;
  status: BookingStatus;
  fulfillment_type: string;
  scheduled_start: string;
  agreed_price_kobo: number;
  accepted_at: string | null;
  listings: { title: string } | null;
}

/** Bookings. Providers own ordinary fulfillment. */
export function OrdersPage() {
  const [searchParams] = useSearchParams();
  const status = searchParams.get("status") ?? undefined;
  const queryClient = useQueryClient();
  const ordersKey = ["provider-orders"] as const;
  const { data: orders } = useApiQuery<Order[]>(ordersKey, "/provider/orders");

  const refetch = () => queryClient.invalidateQueries({ queryKey: ordersKey });

  if (orders === undefined) return <div className="text-muted-foreground">Loading…</div>;

  const filtered = status ? orders.filter((o) => o.status === status) : orders;

  return (
    <>
      <h1 className="font-serif text-2xl font-bold">Bookings</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Accept bookings, coordinate fulfillment, and complete events.
      </p>

      <div className="mb-4 mt-6 flex flex-wrap gap-2">
        <Filter label="All" to="/orders" active={!status} />
        {STATUSES.map((s) => (
          <Filter key={s} label={s.replace("_", " ")} to={`/orders?status=${s}`} active={status === s} />
        ))}
      </div>

      {filtered.length === 0 ? (
        <Card>
          <CardContent className="pt-6 text-sm text-muted-foreground">
            {orders.length === 0 ? "No orders yet." : "No orders match that filter."}
          </CardContent>
        </Card>
      ) : (
        <ul className="space-y-3">
          {filtered.map((o) => (
            <li key={o.id}>
              <Card className="border-l-4 border-l-primary">
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{o.listings?.title}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {new Date(o.scheduled_start).toLocaleString("en-NG")}
                      </p>
                      <p className="mt-1 font-mono text-[11px] text-muted-foreground">{o.reference}</p>
                    </div>
                    <div className="shrink-0 text-right">
                      <StatusPill status={o.status} />
                      <p className="mt-1 text-sm tabular-nums">{formatKobo(o.agreed_price_kobo)}</p>
                    </div>
                  </div>

                  <OrderActions bookingId={o.id} status={o.status} onChanged={refetch} />
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

function Filter({ label, to, active }: { label: string; to: string; active: boolean }) {
  return (
    <Link
      to={to}
      className={`rounded-full border px-3 py-1.5 text-xs font-medium capitalize transition ${
        active ? "border-accent bg-accent text-accent-foreground" : "hover:border-muted-foreground"
      }`}
    >
      {label}
    </Link>
  );
}

/** Accept/reject/start/complete/report-problem controls for one booking row. */
function OrderActions({
  bookingId,
  status,
  onChanged,
}: {
  bookingId: string;
  status: BookingStatus;
  onChanged: () => void;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paid, setPaid] = useState<number | null>(null);
  const [code, setCode] = useState("");
  const [showProblem, setShowProblem] = useState(false);
  const [problem, setProblem] = useState("");
  const [problemSent, setProblemSent] = useState(false);

  const run = async (fn: () => Promise<unknown>) => {
    setPending(true);
    setError(null);
    try {
      await fn();
      onChanged();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "That did not work");
    } finally {
      setPending(false);
    }
  };

  const submitCode = async () => {
    setPending(true);
    setError(null);
    try {
      const { paidKobo } = await apiSend<{ paidKobo: number }>(
        "POST",
        `/provider/orders/${bookingId}/complete`,
        { code },
      );
      setPaid(paidKobo);
      onChanged();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "That code did not work");
    } finally {
      setPending(false);
    }
  };

  const submitProblem = async () => {
    setPending(true);
    setError(null);
    try {
      await apiSend("POST", `/provider/orders/${bookingId}/report-problem`, { message: problem });
      setProblemSent(true);
      onChanged();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not send that");
    } finally {
      setPending(false);
    }
  };

  if (paid !== null) {
    return (
      <p className="mt-4 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
        Done. {paid > 0 ? `${formatKobo(paid)} is on its way to your bank account.` : "This booking is complete."}
      </p>
    );
  }

  if (status === "completed") {
    return <p className="mt-4 text-sm text-emerald-700">Completed and paid.</p>;
  }

  if (status === "disputed") {
    return (
      <p className="mt-4 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
        Nexa is looking into this booking. We'll be in touch.
      </p>
    );
  }

  return (
    <div className="mt-4 space-y-3">
      {status === "paid_held" ? (
        <div>
          <p className="mb-2 text-xs text-muted-foreground">
            The customer has paid and Nexa is holding the whole amount. Accept it, do the job, and you get paid the
            moment you enter their code.
          </p>
          <div className="flex gap-2">
            <Button
              disabled={pending}
              onClick={() => run(() => apiSend("POST", `/provider/orders/${bookingId}/accept`))}
            >
              Accept booking
            </Button>
            <Button
              variant="outline"
              disabled={pending}
              onClick={() => run(() => apiSend("POST", `/provider/orders/${bookingId}/reject`))}
            >
              Decline
            </Button>
          </div>
        </div>
      ) : null}

      {status === "accepted" || status === "in_progress" ? (
        <>
          {status === "accepted" ? (
            <Button
              variant="outline"
              disabled={pending}
              onClick={() => run(() => apiSend("POST", `/provider/orders/${bookingId}/start`))}
            >
              Mark work started
            </Button>
          ) : null}

          <div className="rounded-xl border p-3">
            <p className="text-sm font-medium">Finished the job? Enter the customer's code.</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              They give it to you when they're happy. Entering it pays you straight away.
            </p>
            <div className="mt-3 flex gap-2">
              <Input
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="Their code"
                className="w-40 font-mono tracking-widest"
              />
              <Button disabled={pending || code.trim().length === 0} onClick={submitCode}>
                Get paid
              </Button>
            </div>
          </div>

          {!showProblem ? (
            <button
              type="button"
              onClick={() => setShowProblem(true)}
              className="text-xs text-muted-foreground underline"
            >
              The customer won't give me the code
            </button>
          ) : problemSent ? (
            <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
              Thanks — Nexa has your report and will look into it. We may ask you for proof that you did the job.
            </p>
          ) : (
            <div className="rounded-xl border p-3">
              <p className="text-sm font-medium">Tell Nexa what happened</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                We'll contact the customer for the code. If they still refuse and you did the job, Nexa can pay you
                without it.
              </p>
              <Textarea
                value={problem}
                onChange={(e) => setProblem(e.target.value)}
                rows={3}
                placeholder="What happened? Mention any proof you have — photos, messages, delivery notes."
                className="mt-2"
              />
              <div className="mt-2 flex gap-2">
                <Button disabled={pending || problem.trim().length < 10} onClick={submitProblem}>
                  Send to Nexa
                </Button>
                <Button variant="outline" disabled={pending} onClick={() => setShowProblem(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </>
      ) : null}

      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}

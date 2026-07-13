import { notFound } from "next/navigation";
import { requireView, PERMISSIONS as P } from "@/modules/admin";
import { getProviderDetail } from "@/modules/admin";
import {
  featureProviderAction,
  removeProviderAction,
  resolveAppealAction,
  suspendProviderAction,
} from "@/modules/admin/actions";
import { formatKobo } from "@/lib/money";
import { Card, PageHeader } from "@/components/ui";
import { ActionButton } from "../../action-button";
import { ApproveProvider } from "./approve-provider";

export default async function ProviderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireView(P.providersView);
  const d = await getProviderDetail(id);
  if (!d) notFound();

  const { provider, agreement, contact, wallet, reliability, listings, bookings, reviews, strikes } = d;
  const openStrikes = strikes.filter((s) => !s.appealed_at);

  return (
    <>
      <PageHeader
        title={provider.business_name}
        subtitle={`${provider.status}${provider.is_on_probation ? " · on probation" : ""}`}
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        {provider.status === "pending" ? <ApproveProvider providerId={provider.id} /> : null}
        {provider.status === "approved" ? (
          <ActionButton label="Suspend" variant="danger" confirm="Suspend this provider? Their listings hide immediately." run={suspendProviderAction.bind(null, provider.id, true)} />
        ) : null}
        {provider.status === "suspended" ? (
          <ActionButton label="Reinstate" variant="primary" run={suspendProviderAction.bind(null, provider.id, false)} />
        ) : null}
        {provider.status !== "removed" ? (
          <ActionButton label="Remove permanently" variant="danger" prompt="Reason for permanent removal:" run={removeProviderAction.bind(null, provider.id)} />
        ) : null}
        <ActionButton
          label={provider.is_featured ? "Unfeature" : "Feature"}
          run={featureProviderAction.bind(null, provider.id, !provider.is_featured)}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Card>
          <h2 className="text-sm font-semibold">Agreement</h2>
          {agreement ? (
            <dl className="mt-2 space-y-1 text-sm">
              <Row k="Deposit" v={`${agreement.deposit_percent}%`} />
              {agreement.commission_percent_override != null ? <Row k="Commission override" v={`${agreement.commission_percent_override}%`} /> : null}
              {agreement.late_penalty_percent_per_30min_override != null ? <Row k="Late penalty override" v={`${agreement.late_penalty_percent_per_30min_override}%/30min`} /> : null}
            </dl>
          ) : (
            <p className="mt-1 text-sm text-[color:var(--color-ink-muted)]">No active agreement.</p>
          )}
        </Card>

        <Card>
          <h2 className="text-sm font-semibold">Contact & wallet</h2>
          <dl className="mt-2 space-y-1 text-sm">
            <Row k="Phone" v={contact?.contact_phone ?? "—"} />
            <Row k="Email" v={contact?.contact_email ?? "—"} />
            <Row k="Available" v={formatKobo(wallet?.available_kobo ?? 0)} />
            <Row k="Pending" v={formatKobo(wallet?.pending_kobo ?? 0)} />
          </dl>
        </Card>
      </div>

      {reliability ? (
        <Card className="mt-3">
          <h2 className="text-sm font-semibold">Reliability (collected; public display gated)</h2>
          <p className="mt-1 text-xs text-[color:var(--color-ink-muted)]">
            {reliability.completed_bookings} completed · {reliability.on_time_rate}% on time ·{" "}
            {reliability.cancellation_rate}% cancelled
          </p>
        </Card>
      ) : null}

      {strikes.length > 0 ? (
        <Card className="mt-3">
          <h2 className="text-sm font-semibold">Strikes & appeals</h2>
          <ul className="mt-2 space-y-2 text-sm">
            {strikes.map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-3">
                <span>
                  {s.reason}
                  {s.appealed_at ? (s.appeal_upheld ? " · appeal upheld" : " · strike upheld") : " · suspension pending appeal"}
                </span>
                {!s.appealed_at ? (
                  <span className="flex gap-2">
                    <ActionButton label="Uphold appeal" variant="primary" run={resolveAppealAction.bind(null, s.id, true, provider.id)} />
                    <ActionButton label="Fail appeal" variant="danger" run={resolveAppealAction.bind(null, s.id, false, provider.id)} />
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
          {openStrikes.length === 0 ? null : (
            <p className="mt-2 text-xs text-[color:var(--color-ink-muted)]">
              Permanent removal is your call, made with the whole history in view — never automatic.
            </p>
          )}
        </Card>
      ) : null}

      <Card className="mt-3">
        <h2 className="text-sm font-semibold">Listings ({listings.length})</h2>
        <ul className="mt-2 space-y-1 text-sm">
          {listings.map((l) => (
            <li key={l.id} className="flex justify-between">
              <span>{l.title}</span>
              <span className="text-[color:var(--color-ink-muted)]">{l.status}</span>
            </li>
          ))}
        </ul>
      </Card>

      <Card className="mt-3">
        <h2 className="text-sm font-semibold">Recent bookings ({bookings.length})</h2>
        <ul className="mt-2 space-y-1 text-sm">
          {bookings.map((b) => (
            <li key={b.id} className="flex justify-between">
              <span className="font-mono text-xs">{b.reference}</span>
              <span className="text-[color:var(--color-ink-muted)]">{b.status}</span>
            </li>
          ))}
        </ul>
      </Card>

      {reviews.length > 0 ? (
        <Card className="mt-3">
          <h2 className="text-sm font-semibold">Reviews ({reviews.length})</h2>
          <ul className="mt-2 space-y-1 text-sm text-[color:var(--color-ink-muted)]">
            {reviews.map((r) => (
              <li key={r.id}>Q{r.quality} P{r.punctuality} C{r.communication} V{r.value} — {r.comment ?? "no comment"}</li>
            ))}
          </ul>
        </Card>
      ) : null}
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

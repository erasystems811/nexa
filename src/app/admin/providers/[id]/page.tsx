import { notFound } from "next/navigation";
import { requireView, getProviderDetail, PERMISSIONS as P } from "@/modules/admin";
import {
  approveProviderAction,
  featureProviderAction,
  rejectProviderAction,
  removeProviderAction,
  resolveAppealAction,
  suspendProviderAction,
} from "@/modules/admin/actions";
import { formatKobo } from "@/lib/money";
import { Card, PageHeader } from "@/components/ui";
import { ActionButton } from "../../action-button";

const STATUS_LABEL: Record<string, string> = {
  pending: "Waiting for your approval",
  approved: "Approved — selling on Nexa",
  suspended: "Suspended — listings hidden",
  rejected: "Rejected",
  removed: "Removed",
};

export default async function ProviderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireView(P.providersView);
  const d = await getProviderDetail(id);
  if (!d) notFound();

  const { provider, contact, wallet, reliability, listings, bookings, reviews, strikes } = d;
  const openStrikes = strikes.filter((s) => !s.appealed_at);

  return (
    <>
      <PageHeader
        title={provider.business_name}
        subtitle={`${STATUS_LABEL[provider.status] ?? provider.status}${provider.is_on_probation ? " · on probation" : ""}`}
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        {provider.status === "pending" ? (
          <>
            <ActionButton
              label="Approve this vendor"
              variant="primary"
              confirm="Approve this vendor? They can list their services on Nexa straight away."
              run={approveProviderAction.bind(null, provider.id)}
            />
            <ActionButton
              label="Reject"
              variant="danger"
              prompt="Why are you rejecting them?"
              run={rejectProviderAction.bind(null, provider.id)}
            />
          </>
        ) : null}
        {provider.status === "approved" ? (
          <ActionButton label="Suspend" variant="danger" confirm="Suspend this vendor? Their listings hide immediately." run={suspendProviderAction.bind(null, provider.id, true)} />
        ) : null}
        {provider.status === "suspended" ? (
          <ActionButton label="Reinstate" variant="primary" run={suspendProviderAction.bind(null, provider.id, false)} />
        ) : null}
        {provider.status !== "removed" ? (
          <ActionButton label="Remove permanently" variant="danger" prompt="Why are you removing them?" run={removeProviderAction.bind(null, provider.id)} />
        ) : null}
        <ActionButton
          label={provider.is_featured ? "Stop featuring" : "Feature on the homepage"}
          run={featureProviderAction.bind(null, provider.id, !provider.is_featured)}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Card>
          <h2 className="text-sm font-semibold">Contact</h2>
          <dl className="mt-2 space-y-1 text-sm">
            <Row k="Phone" v={contact?.contact_phone ?? "—"} />
            <Row k="Email" v={contact?.contact_email ?? "—"} />
          </dl>
        </Card>

        <Card>
          <h2 className="text-sm font-semibold">Bank account</h2>
          {wallet?.bank_account_number ? (
            <dl className="mt-2 space-y-1 text-sm">
              <Row k="Account" v={wallet.bank_account_number} />
              <Row k="Paid out so far" v={formatKobo(wallet.withdrawn_kobo ?? 0)} />
            </dl>
          ) : (
            <p className="mt-1 text-sm text-[color:var(--color-ink-muted)]">
              No bank account saved. Until they add one in Business Studio you cannot pay them.
            </p>
          )}
        </Card>
      </div>

      {reliability ? (
        <Card className="mt-3">
          <h2 className="text-sm font-semibold">Track record</h2>
          <p className="mt-1 text-xs text-[color:var(--color-ink-muted)]">
            {reliability.completed_bookings} jobs done · {reliability.on_time_rate}% on time ·{" "}
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
                  {s.appealed_at ? (s.appeal_upheld ? " · appeal upheld" : " · strike upheld") : " · suspended, waiting on their appeal"}
                </span>
                {!s.appealed_at ? (
                  <span className="flex gap-2">
                    <ActionButton label="Accept their appeal" variant="primary" run={resolveAppealAction.bind(null, s.id, true, provider.id)} />
                    <ActionButton label="Turn it down" variant="danger" run={resolveAppealAction.bind(null, s.id, false, provider.id)} />
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
          {openStrikes.length === 0 ? null : (
            <p className="mt-2 text-xs text-[color:var(--color-ink-muted)]">
              Removing a vendor for good is always your call — it never happens automatically.
            </p>
          )}
        </Card>
      ) : null}

      <Card className="mt-3">
        <h2 className="text-sm font-semibold">Listings ({listings.length})</h2>
        <ul className="mt-2 space-y-1 text-sm">
          {listings.map((l) => (
            <li key={l.id} className="flex justify-between gap-3">
              <span>{l.title}</span>
              <span className="shrink-0 text-[color:var(--color-ink-muted)]">{l.status.replace(/_/g, " ")}</span>
            </li>
          ))}
        </ul>
      </Card>

      <Card className="mt-3">
        <h2 className="text-sm font-semibold">Recent bookings ({bookings.length})</h2>
        <ul className="mt-2 space-y-1 text-sm">
          {bookings.map((b) => (
            <li key={b.id} className="flex justify-between gap-3">
              <span className="font-mono text-xs">{b.reference}</span>
              <span className="shrink-0 text-[color:var(--color-ink-muted)]">{b.status.replace(/_/g, " ")}</span>
            </li>
          ))}
        </ul>
      </Card>

      {reviews.length > 0 ? (
        <Card className="mt-3">
          <h2 className="text-sm font-semibold">Reviews ({reviews.length})</h2>
          <ul className="mt-2 space-y-1 text-sm text-[color:var(--color-ink-muted)]">
            {reviews.map((r) => (
              <li key={r.id}>
                Quality {r.quality} · on time {r.punctuality} · {r.comment ?? "no comment"}
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
      <dt className="text-[color:var(--color-ink-muted)]">{k}</dt>
      <dd className="text-right">{v}</dd>
    </div>
  );
}

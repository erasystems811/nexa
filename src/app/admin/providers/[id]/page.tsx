import { notFound } from "next/navigation";
import { requireView, getProviderDetail, PERMISSIONS as P } from "@/modules/admin";
import {
  approveProviderAction,
  decideDocumentAction,
  featureProviderAction,
  rejectProviderAction,
  removeProviderAction,
  resolveAppealAction,
  suspendProviderAction,
} from "@/modules/admin/actions";
import { bankName } from "@/modules/payments";
import { formatKobo } from "@/lib/money";
import { Card, PageHeader } from "@/components/ui";
import { ActionButton } from "../../action-button";

const DOC_STATUS_LABEL: Record<string, string> = {
  pending: "Waiting for you to look at it",
  approved: "Approved by Nexa",
  rejected: "Rejected",
};

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

  const { provider, contact, wallet, reliability, listings, bookings, reviews, strikes, identity } = d;

  // The code is what the processor is paid by; the name is the only part an
  // admin can sanity-check against the business in front of them.
  const bank = await bankName(wallet?.bank_code ?? null);

  const categoryName =
    (provider.provider_categories as unknown as
      | Array<{ categories: { name: string } | null }>
      | null)?.[0]?.categories?.name ?? null;
  const openStrikes = strikes.filter((s) => !s.appealed_at);
  const waiting = identity.documents.filter((doc) => doc.status === "pending");

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

      {/* What they actually wrote on their application. You cannot judge a vendor
          you cannot see. */}
      <Card className="mb-3">
        <h2 className="text-sm font-semibold">Their application</h2>
        <dl className="mt-3 space-y-2 text-sm">
          <Row k="Business" v={provider.business_name} />
          <Row k="Service" v={categoryName ?? "—"} />
          <Row k="City" v={(provider.cities as unknown as { name: string } | null)?.name ?? "—"} />
          <Row k="Phone" v={contact?.contact_phone ?? "—"} />
          <Row k="Email" v={contact?.contact_email ?? "—"} />
          <Row
            k="Applied"
            v={new Date(provider.created_at).toLocaleString("en-NG")}
          />
        </dl>
        {provider.description ? (
          <>
            <p className="mt-4 text-xs font-medium text-[color:var(--color-ink-muted)]">
              What they say they do
            </p>
            <p className="mt-1 whitespace-pre-line text-sm leading-relaxed">
              {provider.description}
            </p>
          </>
        ) : null}
      </Card>

      <Card className="mb-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold">Who they are</h2>
            <p className="mt-1 text-xs text-[color:var(--color-ink-muted)]">
              {identity.verified
                ? "Verified. Their services can go live."
                : `Not verified. Nexa needs ${identity.required} means of identification approved before any service of theirs reaches a customer.`}
            </p>
          </div>
          <span
            className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium ${
              identity.verified
                ? "bg-emerald-50 text-[color:var(--color-success)]"
                : "bg-amber-50 text-amber-900"
            }`}
          >
            {identity.verified ? "Verified" : `${waiting.length} waiting`}
          </span>
        </div>

        {identity.documents.length === 0 ? (
          <p className="mt-4 text-sm text-[color:var(--color-ink-muted)]">
            Nothing submitted yet. They are asked for their ID the moment they sign in to Business
            Studio, and cannot list a service until you have approved two.
          </p>
        ) : (
          <ul className="mt-4 space-y-3">
            {identity.documents.map((doc) => (
              <li
                key={doc.id}
                className="rounded-xl border border-[color:var(--color-line)] p-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{doc.label}</p>
                    {doc.idNumber ? (
                      <p className="mt-0.5 font-mono text-xs text-[color:var(--color-ink-muted)]">
                        {doc.idNumber}
                      </p>
                    ) : null}
                    <p className="mt-1 text-[11px] text-[color:var(--color-ink-muted)]">
                      {DOC_STATUS_LABEL[doc.status] ?? doc.status}
                      {doc.notes ? ` — ${doc.notes}` : ""}
                    </p>
                  </div>
                  {doc.url ? (
                    <a
                      href={doc.url}
                      target="_blank"
                      rel="noreferrer"
                      className="shrink-0 text-xs font-medium underline"
                    >
                      Look at the photo
                    </a>
                  ) : null}
                </div>

                {doc.status === "pending" ? (
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <ActionButton
                      label="Approve this ID"
                      variant="primary"
                      confirm="Have you looked at the photo, and does it match the business?"
                      run={decideDocumentAction.bind(null, doc.id, provider.id, true)}
                    />
                    <ActionButton
                      label="Ask them to fix it"
                      variant="danger"
                      prompt="What is wrong with it? This is emailed to them word for word."
                      run={decideDocumentAction.bind(null, doc.id, provider.id, false)}
                    />
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </Card>

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
              <Row k="Bank" v={bank ?? "—"} />
              <Row k="Account" v={wallet.bank_account_number} />
              <Row k="Name" v={wallet.bank_account_name ?? "—"} />
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

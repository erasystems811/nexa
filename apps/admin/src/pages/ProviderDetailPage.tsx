import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { formatKobo } from "@nexa/money";
import { Card, CardContent } from "@nexa/design-system/src/components/ui/card";
import { Badge } from "@nexa/design-system/src/components/ui/badge";
import { apiGet, apiSend } from "../lib/api";
import { ActionButton } from "../components/action-button";
import { useAuth } from "../auth/AuthContext";
import { PERMISSIONS as P, can } from "../lib/permissions";

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

interface AdminIdDocument {
  id: string;
  kind: string;
  label: string;
  idNumber: string | null;
  status: string;
  notes: string | null;
  source: string | null;
  createdAt: string;
  url: string | null;
}

interface Provider {
  id: string;
  business_name: string;
  status: string;
  is_featured: boolean;
  is_on_probation: boolean;
  description: string | null;
  created_at: string;
  cities: { name: string } | null;
  provider_categories: Array<{ categories: { name: string } | null }> | null;
}

interface ProviderContact {
  contact_phone: string | null;
  contact_email: string | null;
}

interface ProviderWallet {
  bank_code: string | null;
  bank_account_number: string | null;
  bank_account_name: string | null;
  withdrawn_kobo: number | null;
}

interface ProviderReliability {
  completed_bookings: number;
  on_time_rate: number;
  cancellation_rate: number;
}

interface Listing {
  id: string;
  title: string;
  status: string;
  price_kobo: number | null;
  price_type: string;
}

interface Booking {
  id: string;
  reference: string;
  status: string;
}

interface Review {
  id: string;
  quality: number;
  punctuality: number;
  comment: string | null;
}

interface Strike {
  id: string;
  reason: string;
  appealed_at: string | null;
  appeal_upheld: boolean | null;
}

interface ProviderDetail {
  provider: Provider;
  contact: ProviderContact | null;
  wallet: ProviderWallet | null;
  reliability: ProviderReliability | null;
  listings: Listing[];
  bookings: Booking[];
  reviews: Review[];
  strikes: Strike[];
  identity: {
    verified: boolean;
    required: number;
    documents: AdminIdDocument[];
  };
}

/** A vendor: their application, identity, strikes/appeals, listings, bookings, reviews. */
export function ProviderDetailPage() {
  const { id = "" } = useParams<{ id: string }>();
  const { staff } = useAuth();
  const [d, setD] = useState<ProviderDetail | null>(null);

  function load() {
    apiGet<ProviderDetail>(`/admin/providers/${id}`).then(setD);
  }

  useEffect(load, [id]);

  if (!can(staff, P.providersView)) {
    return <p className="text-sm text-muted-foreground">You do not have permission to view vendors.</p>;
  }

  if (!d) return <div className="text-muted-foreground">Loading…</div>;

  const { provider, contact, wallet, reliability, listings, bookings, reviews, strikes, identity } = d;

  // Categories live per listing, not per vendor — a vendor selling across
  // several (catering AND DJ) shows every one here, not just the first.
  const categoryNames = provider.provider_categories
    ?.map((pc) => pc.categories?.name)
    .filter((name): name is string => Boolean(name));
  const openStrikes = strikes.filter((s) => !s.appealed_at);
  const waiting = identity.documents.filter((doc) => doc.status === "pending");
  const pendingListings = listings.filter((l) => l.status === "pending_approval");

  return (
    <>
      <h1 className="font-serif text-2xl font-bold">{provider.business_name}</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {STATUS_LABEL[provider.status] ?? provider.status}
        {provider.is_on_probation ? " · on probation" : ""}
      </p>

      <div className="mb-4 mt-4 flex flex-wrap items-center gap-2">
        {provider.status === "pending" && can(staff, P.providersApprove) ? (
          <>
            <ActionButton
              label={
                pendingListings.length > 0
                  ? `Approve vendor + ${pendingListings.length} listing${pendingListings.length === 1 ? "" : "s"}`
                  : "Approve this vendor"
              }
              variant="primary"
              confirm={
                pendingListings.length > 0
                  ? `Approve this vendor? This also approves their ${pendingListings.length} submitted listing${pendingListings.length === 1 ? "" : "s"} and both ID documents in one go — everything goes live at once.`
                  : "Approve this vendor? They can list their services on Nexa straight away."
              }
              run={async () => {
                const result = await apiSend<{ warning?: string }>(
                  "POST",
                  `/admin/providers/${provider.id}/approve-with-listings`,
                );
                load();
                return result.warning;
              }}
            />
            <ActionButton
              label="Reject"
              variant="danger"
              prompt="Why are you rejecting them?"
              run={(reason) => apiSend("POST", `/admin/providers/${provider.id}/reject`, { reason }).then(load)}
            />
          </>
        ) : null}
        {provider.status === "approved" && can(staff, P.providersSuspend) ? (
          <ActionButton
            label="Suspend"
            variant="danger"
            confirm="Suspend this vendor? Their listings hide immediately."
            run={() => apiSend("POST", `/admin/providers/${provider.id}/suspend`, { suspended: true }).then(load)}
          />
        ) : null}
        {provider.status === "suspended" && can(staff, P.providersSuspend) ? (
          <ActionButton
            label="Reinstate"
            variant="primary"
            run={() => apiSend("POST", `/admin/providers/${provider.id}/suspend`, { suspended: false }).then(load)}
          />
        ) : null}
        {provider.status !== "removed" && can(staff, P.providersRemove) ? (
          <ActionButton
            label="Remove permanently"
            variant="danger"
            prompt="Why are you removing them?"
            run={(reason) => apiSend("POST", `/admin/providers/${provider.id}/remove`, { reason }).then(load)}
          />
        ) : null}
        {can(staff, P.providersEdit) ? (
          <ActionButton
            label={provider.is_featured ? "Stop featuring" : "Feature on the homepage"}
            run={() =>
              apiSend("POST", `/admin/providers/${provider.id}/feature`, { featured: !provider.is_featured }).then(load)
            }
          />
        ) : null}
      </div>

      {/* What they actually wrote on their application. You cannot judge a vendor
          you cannot see. */}
      <Card className="mb-3">
        <CardContent className="pt-6">
          <h2 className="text-sm font-semibold">Their application</h2>
          <dl className="mt-3 space-y-2 text-sm">
            <Row k="Business" v={provider.business_name} />
            <Row k="Categories" v={categoryNames && categoryNames.length > 0 ? categoryNames.join(", ") : "—"} />
            <Row k="City" v={provider.cities?.name ?? "—"} />
            <Row k="Phone" v={contact?.contact_phone ?? "—"} />
            <Row k="Email" v={contact?.contact_email ?? "—"} />
            <Row k="Applied" v={new Date(provider.created_at).toLocaleString("en-NG")} />
          </dl>
          {provider.description ? (
            <>
              <p className="mt-4 text-xs font-medium text-muted-foreground">What they say they do</p>
              <p className="mt-1 whitespace-pre-line text-sm leading-relaxed">{provider.description}</p>
            </>
          ) : null}
        </CardContent>
      </Card>

      <Card className="mb-3">
        <CardContent className="pt-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold">Who they are</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                {identity.verified
                  ? "Verified. Their services can go live."
                  : `Not verified. Nexa needs ${identity.required} means of identification approved before any service of theirs reaches a customer.`}
              </p>
            </div>
            <Badge variant={identity.verified ? "default" : "secondary"} className="shrink-0">
              {identity.verified ? "Verified" : `${waiting.length} waiting`}
            </Badge>
          </div>

          {identity.documents.length === 0 ? (
            <p className="mt-4 text-sm text-muted-foreground">
              Nothing submitted yet. They are asked for their ID the moment they sign in to Business Studio, and
              cannot list a service until you have approved two.
            </p>
          ) : (
            <ul className="mt-4 space-y-3">
              {identity.documents.map((doc) => (
                <li key={doc.id} className="rounded-xl border p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{doc.label}</p>
                      {doc.idNumber ? <p className="mt-0.5 font-mono text-xs text-muted-foreground">{doc.idNumber}</p> : null}
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        {DOC_STATUS_LABEL[doc.status] ?? doc.status}
                        {doc.notes ? ` — ${doc.notes}` : ""}
                      </p>
                    </div>
                    {doc.url ? (
                      <a href={doc.url} target="_blank" rel="noreferrer" className="shrink-0 text-xs font-medium underline">
                        Look at the photo
                      </a>
                    ) : null}
                  </div>

                  {doc.status === "pending" && can(staff, P.providersApprove) ? (
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <ActionButton
                        label="Approve this ID"
                        variant="primary"
                        confirm="Have you looked at the photo, and does it match the business?"
                        run={() =>
                          apiSend("POST", `/admin/providers/${provider.id}/documents/${doc.id}/decide`, {
                            approved: true,
                          }).then(load)
                        }
                      />
                      <ActionButton
                        label="Ask them to fix it"
                        variant="danger"
                        prompt="What is wrong with it? This is emailed to them word for word."
                        run={(notes) =>
                          apiSend("POST", `/admin/providers/${provider.id}/documents/${doc.id}/decide`, {
                            approved: false,
                            notes,
                          }).then(load)
                        }
                      />
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2">
        <Card>
          <CardContent className="pt-6">
            <h2 className="text-sm font-semibold">Contact</h2>
            <dl className="mt-2 space-y-1 text-sm">
              <Row k="Phone" v={contact?.contact_phone ?? "—"} />
              <Row k="Email" v={contact?.contact_email ?? "—"} />
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <h2 className="text-sm font-semibold">Bank account</h2>
            {wallet?.bank_account_number ? (
              <dl className="mt-2 space-y-1 text-sm">
                <Row k="Bank" v={wallet.bank_code ?? "—"} />
                <Row k="Account" v={wallet.bank_account_number} />
                <Row k="Name" v={wallet.bank_account_name ?? "—"} />
                <Row k="Paid out so far" v={formatKobo(wallet.withdrawn_kobo ?? 0)} />
              </dl>
            ) : (
              <p className="mt-1 text-sm text-muted-foreground">
                No bank account saved. Until they add one in Business Studio you cannot pay them.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {reliability ? (
        <Card className="mt-3">
          <CardContent className="pt-6">
            <h2 className="text-sm font-semibold">Track record</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              {reliability.completed_bookings} jobs done · {reliability.on_time_rate}% on time ·{" "}
              {reliability.cancellation_rate}% cancelled
            </p>
          </CardContent>
        </Card>
      ) : null}

      {strikes.length > 0 ? (
        <Card className="mt-3">
          <CardContent className="pt-6">
            <h2 className="text-sm font-semibold">Strikes &amp; appeals</h2>
            <ul className="mt-2 space-y-2 text-sm">
              {strikes.map((s) => (
                <li key={s.id} className="flex items-center justify-between gap-3">
                  <span>
                    {s.reason}
                    {s.appealed_at
                      ? s.appeal_upheld
                        ? " · appeal upheld"
                        : " · strike upheld"
                      : " · suspended, waiting on their appeal"}
                  </span>
                  {!s.appealed_at && can(staff, P.providersSuspend) ? (
                    <span className="flex gap-2">
                      <ActionButton
                        label="Accept their appeal"
                        variant="primary"
                        run={() => apiSend("POST", `/admin/strikes/${s.id}/appeal`, { upheld: true }).then(load)}
                      />
                      <ActionButton
                        label="Turn it down"
                        variant="danger"
                        run={() => apiSend("POST", `/admin/strikes/${s.id}/appeal`, { upheld: false }).then(load)}
                      />
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
            {openStrikes.length === 0 ? null : (
              <p className="mt-2 text-xs text-muted-foreground">
                Removing a vendor for good is always your call — it never happens automatically.
              </p>
            )}
          </CardContent>
        </Card>
      ) : null}

      <Card className="mt-3">
        <CardContent className="pt-6">
          <h2 className="text-sm font-semibold">Listings ({listings.length})</h2>
          <ul className="mt-2 space-y-1 text-sm">
            {listings.map((l) => (
              <li key={l.id} className="flex justify-between gap-3">
                <span>
                  {l.title}
                  {l.price_type === "fixed" && l.price_kobo != null ? (
                    <span className="text-muted-foreground"> — {formatKobo(l.price_kobo)}</span>
                  ) : null}
                </span>
                <span className="shrink-0 text-muted-foreground">{l.status.replace(/_/g, " ")}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card className="mt-3">
        <CardContent className="pt-6">
          <h2 className="text-sm font-semibold">Recent bookings ({bookings.length})</h2>
          <ul className="mt-2 space-y-1 text-sm">
            {bookings.map((b) => (
              <li key={b.id} className="flex justify-between gap-3">
                <span className="font-mono text-xs">{b.reference}</span>
                <span className="shrink-0 text-muted-foreground">{b.status.replace(/_/g, " ")}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {reviews.length > 0 ? (
        <Card className="mt-3">
          <CardContent className="pt-6">
            <h2 className="text-sm font-semibold">Reviews ({reviews.length})</h2>
            <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
              {reviews.map((r) => (
                <li key={r.id}>
                  Quality {r.quality} · on time {r.punctuality} · {r.comment ?? "no comment"}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}
    </>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-muted-foreground">{k}</dt>
      <dd className="text-right">{v}</dd>
    </div>
  );
}

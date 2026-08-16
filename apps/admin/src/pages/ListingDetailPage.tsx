import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { formatKobo } from "@nexa/money";
import { Card, CardContent } from "@nexa/design-system/src/components/ui/card";
import { apiGet, apiSend } from "../lib/api";
import { useAuth } from "../auth/AuthContext";
import { PERMISSIONS as P, can } from "../lib/permissions";
import { ActionButton } from "../components/action-button";

const STATUS_LABEL: Record<string, string> = {
  pending_approval: "Waiting for you",
  approved: "Live",
  changes_requested: "Changes asked for",
  hidden: "Hidden",
  rejected: "Rejected",
  draft: "Draft",
  paused: "Paused",
};

interface CancellationTier {
  min_hours_before: number;
  refund_percent: number;
}

interface Listing {
  id: string;
  title: string;
  status: string;
  description: string | null;
  price_type: string;
  price_kobo: number | null;
  price_min_kobo: number | null;
  price_max_kobo: number | null;
  payment_type: string;
  cancellation_policy: unknown;
  providers: { id: string; business_name: string; slug: string } | null;
  categories: { name: string; fulfillment_type: string } | null;
}

interface Media {
  id: string;
  kind: string;
  storage_path: string;
  status: string;
  alt_text: string | null;
  sort_order: number;
  url: string | null;
}

/**
 * A listing, in full, before it goes live.
 *
 * The admin was approving listings from a one-line row — no photos, no
 * description, no policy — which is to say approving them blind. This is the
 * screen that lets a person actually look: the pictures the vendor uploaded,
 * the words they wrote, the price and the cancellation terms, and the decision
 * buttons in one place.
 */
export function ListingDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { staff } = useAuth();
  const [result, setResult] = useState<{ listing: Listing; media: Media[] } | null | undefined>(undefined);

  function reload() {
    if (!id) return;
    apiGet<{ listing: Listing; media: Media[] }>(`/admin/listings/${id}`)
      .then(setResult)
      .catch(() => setResult(null));
  }

  useEffect(reload, [id]);

  if (!can(staff, P.listingsView)) {
    return <p className="text-sm text-muted-foreground">You do not have permission to view listings.</p>;
  }

  if (result === undefined) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (result === null) return <p className="text-sm text-muted-foreground">That listing does not exist.</p>;

  const { listing, media } = result;
  const provider = listing.providers;
  const category = listing.categories;
  const policy = Array.isArray(listing.cancellation_policy) ? (listing.cancellation_policy as CancellationTier[]) : [];
  const canApprove = can(staff, P.listingsApprove);

  const price =
    listing.price_type === "fixed" && listing.price_kobo != null
      ? formatKobo(listing.price_kobo)
      : listing.price_min_kobo != null && listing.price_max_kobo != null
        ? `${formatKobo(listing.price_min_kobo)} – ${formatKobo(listing.price_max_kobo)}`
        : "Price on request";

  const canDecide = listing.status === "pending_approval" || listing.status === "changes_requested";

  return (
    <>
      <h1 className="font-serif text-2xl font-bold">{listing.title}</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {provider?.business_name ?? "Unknown vendor"} · {category?.name ?? "—"}
      </p>

      <div className="mb-4 mt-4 flex items-center gap-2">
        <span className="rounded-full bg-muted px-2.5 py-0.5 text-[11px] font-medium">
          {STATUS_LABEL[listing.status] ?? listing.status}
        </span>
        <span className="text-lg font-semibold text-accent">{price}</span>
      </div>

      {/* Photos — the whole reason this screen exists. */}
      <Card className="mb-4">
        <CardContent className="pt-6">
          <h2 className="mb-3 text-sm font-semibold">Photos {media.length > 0 ? `(${media.length})` : ""}</h2>
          {media.length === 0 ? (
            <p className="text-sm text-muted-foreground">The vendor has not added any photos to this listing yet.</p>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {media.map((m) => (
                <div key={m.id} className="overflow-hidden rounded-xl border">
                  <div className="aspect-[4/3] bg-muted">
                    {m.url && m.kind === "image" ? (
                      <img src={m.url} alt={m.alt_text ?? ""} className="h-full w-full object-cover" />
                    ) : m.url && m.kind === "video" ? (
                      <video src={m.url} controls className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                        preview unavailable
                      </div>
                    )}
                  </div>
                  <p className="px-2 py-1 text-[11px] text-muted-foreground">
                    {m.status === "approved" ? "Approved" : "Waiting for approval"}
                  </p>
                  {canApprove && m.status !== "approved" ? (
                    <div className="flex gap-1.5 border-t p-1.5">
                      <ActionButton
                        label="Approve"
                        variant="primary"
                        run={() => apiSend("POST", `/admin/media/${m.id}/decide`, { approved: true }).then(reload)}
                      />
                      <ActionButton
                        label="Reject"
                        variant="danger"
                        run={() => apiSend("POST", `/admin/media/${m.id}/decide`, { approved: false }).then(reload)}
                      />
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          )}
          <p className="mt-3 text-xs text-muted-foreground">
            Approving the listing approves its photos alongside it. A photo added to a listing that is already live
            is approved here, on its own.
          </p>
        </CardContent>
      </Card>

      <Card className="mb-4">
        <CardContent className="pt-6">
          <h2 className="mb-2 text-sm font-semibold">Description</h2>
          <p className="whitespace-pre-wrap text-sm text-muted-foreground">
            {listing.description?.trim() || "No description written."}
          </p>
        </CardContent>
      </Card>

      <Card className="mb-4">
        <CardContent className="pt-6">
          <h2 className="mb-3 text-sm font-semibold">Details</h2>
          <dl className="space-y-1.5 text-sm">
            <Row k="Price" v={price} />
            <Row k="Pricing" v={listing.price_type === "fixed" ? "Fixed price" : "Negotiable / on request"} />
            <Row
              k="Payment"
              v={listing.payment_type === "full" ? "Paid in full" : String(listing.payment_type).replace(/_/g, " ")}
            />
            <Row k="Category" v={category?.name ?? "—"} />
          </dl>
        </CardContent>
      </Card>

      <Card className="mb-4">
        <CardContent className="pt-6">
          <h2 className="mb-3 text-sm font-semibold">Cancellation policy</h2>
          {policy.length === 0 ? (
            <p className="text-sm text-muted-foreground">No cancellation tiers set.</p>
          ) : (
            <ul className="space-y-1.5 text-sm">
              {policy.map((t, i) => (
                <li key={i} className="flex justify-between gap-3">
                  <span className="text-muted-foreground">Cancel {t.min_hours_before}+ hours before</span>
                  <span className="tabular-nums">{t.refund_percent}% refund</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Decisions. */}
      {canApprove ? (
        <div className="flex flex-wrap gap-2">
          {canDecide ? (
            <ActionButton
              label="Approve — put it live"
              variant="primary"
              confirm="Have you looked at the photos and the details? This makes the listing public."
              run={() => apiSend("POST", `/admin/listings/${listing.id}/decide`, { decision: "approved" }).then(reload)}
            />
          ) : null}

          {listing.status === "pending_approval" ? (
            <>
              <ActionButton
                label="Ask for changes"
                prompt="What needs changing? The vendor sees this."
                run={(reason) =>
                  apiSend("POST", `/admin/listings/${listing.id}/decide`, { decision: "changes_requested", reason }).then(
                    reload,
                  )
                }
              />
              <ActionButton
                label="Reject"
                variant="danger"
                prompt="Why? The vendor sees this."
                run={(reason) =>
                  apiSend("POST", `/admin/listings/${listing.id}/decide`, { decision: "rejected", reason }).then(reload)
                }
              />
            </>
          ) : null}

          {listing.status === "approved" ? (
            <ActionButton
              label="Take it down"
              variant="danger"
              confirm="Hide this listing? Customers stop seeing it immediately."
              run={() => apiSend("POST", `/admin/listings/${listing.id}/decide`, { decision: "hidden" }).then(reload)}
            />
          ) : null}

          {listing.status === "hidden" || listing.status === "rejected" ? (
            <ActionButton
              label="Put it back"
              variant="primary"
              run={() => apiSend("POST", `/admin/listings/${listing.id}/restore`).then(reload)}
            />
          ) : null}
        </div>
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

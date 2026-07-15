import { notFound } from "next/navigation";
import { requireView, getListingForReview, PERMISSIONS as P } from "@/modules/admin";
import { decideListingAction, restoreListingAction } from "@/modules/admin/actions";
import { formatKobo } from "@/lib/money";
import { Card, PageHeader } from "@/components/ui";
import { AdminBack } from "@/components/admin-back";
import { ActionButton } from "../../action-button";

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

/**
 * A listing, in full, before it goes live.
 *
 * The admin was approving listings from a one-line row — no photos, no
 * description, no policy — which is to say approving them blind. This is the
 * screen that lets a person actually look: the pictures the vendor uploaded,
 * the words they wrote, the price and the cancellation terms, and the decision
 * buttons in one place.
 */
export default async function AdminListingDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireView(P.listingsView);

  const result = await getListingForReview(id);
  if (!result) notFound();

  const { listing, media } = result;
  const provider = listing.providers as unknown as { business_name: string; slug: string } | null;
  const category = listing.categories as unknown as { name: string } | null;
  const policy = Array.isArray(listing.cancellation_policy)
    ? (listing.cancellation_policy as unknown[] as CancellationTier[])
    : [];

  const price =
    listing.price_type === "fixed" && listing.price_kobo != null
      ? formatKobo(listing.price_kobo)
      : listing.price_min_kobo != null && listing.price_max_kobo != null
        ? `${formatKobo(listing.price_min_kobo)} – ${formatKobo(listing.price_max_kobo)}`
        : "Price on request";

  const canDecide = listing.status === "pending_approval" || listing.status === "changes_requested";

  return (
    <>
      <AdminBack fallback="/listings" />

      <div className="mt-3">
        <PageHeader
          title={listing.title}
          subtitle={`${provider?.business_name ?? "Unknown vendor"} · ${category?.name ?? "—"}`}
        />
      </div>

      <div className="mb-4 flex items-center gap-2">
        <span className="rounded-full bg-[color:var(--color-surface-sunk)] px-2.5 py-0.5 text-[11px] font-medium">
          {STATUS_LABEL[listing.status] ?? listing.status}
        </span>
        <span className="text-lg font-semibold text-[color:var(--color-accent)]">{price}</span>
      </div>

      {/* Photos — the whole reason this screen exists. */}
      <Card className="mb-4">
        <h2 className="mb-3 text-sm font-semibold">
          Photos {media.length > 0 ? `(${media.length})` : ""}
        </h2>
        {media.length === 0 ? (
          <p className="text-sm text-[color:var(--color-ink-muted)]">
            The vendor has not added any photos to this listing yet.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {media.map((m) => (
              <div key={m.id} className="overflow-hidden rounded-xl border border-[color:var(--color-line)]">
                <div className="aspect-[4/3] bg-[color:var(--color-surface-sunk)]">
                  {m.url && m.kind === "image" ? (
                    // eslint-disable-next-line @next/next/no-img-element -- private storage, signed URL
                    <img src={m.url} alt={m.alt_text ?? ""} className="h-full w-full object-cover" />
                  ) : m.url && m.kind === "video" ? (
                    <video src={m.url} controls className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full items-center justify-center text-xs text-[color:var(--color-ink-muted)]">
                      preview unavailable
                    </div>
                  )}
                </div>
                <p className="px-2 py-1 text-[11px] text-[color:var(--color-ink-muted)]">
                  {m.status === "approved" ? "Approved" : "Waiting for approval"}
                </p>
              </div>
            ))}
          </div>
        )}
        <p className="mt-3 text-xs text-[color:var(--color-ink-muted)]">
          Approving the listing approves its photos alongside it.
        </p>
      </Card>

      <Card className="mb-4">
        <h2 className="mb-2 text-sm font-semibold">Description</h2>
        <p className="whitespace-pre-wrap text-sm text-[color:var(--color-ink-muted)]">
          {listing.description?.trim() || "No description written."}
        </p>
      </Card>

      <Card className="mb-4">
        <h2 className="mb-3 text-sm font-semibold">Details</h2>
        <dl className="space-y-1.5 text-sm">
          <Row k="Price" v={price} />
          <Row
            k="Pricing"
            v={listing.price_type === "fixed" ? "Fixed price" : "Negotiable / on request"}
          />
          <Row
            k="Payment"
            v={listing.payment_type === "full" ? "Paid in full" : String(listing.payment_type).replace(/_/g, " ")}
          />
          <Row k="Category" v={category?.name ?? "—"} />
        </dl>
      </Card>

      <Card className="mb-4">
        <h2 className="mb-3 text-sm font-semibold">Cancellation policy</h2>
        {policy.length === 0 ? (
          <p className="text-sm text-[color:var(--color-ink-muted)]">No cancellation tiers set.</p>
        ) : (
          <ul className="space-y-1.5 text-sm">
            {policy.map((t, i) => (
              <li key={i} className="flex justify-between gap-3">
                <span className="text-[color:var(--color-ink-muted)]">
                  Cancel {t.min_hours_before}+ hours before
                </span>
                <span className="tabular-nums">{t.refund_percent}% refund</span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* Decisions. */}
      <div className="flex flex-wrap gap-2">
        {canDecide ? (
          <ActionButton
            label="Approve — put it live"
            variant="primary"
            confirm="Have you looked at the photos and the details? This makes the listing public."
            run={decideListingAction.bind(null, listing.id, "approved")}
          />
        ) : null}

        {listing.status === "pending_approval" ? (
          <>
            <ActionButton
              label="Ask for changes"
              prompt="What needs changing? The vendor sees this."
              run={decideListingAction.bind(null, listing.id, "changes_requested")}
            />
            <ActionButton
              label="Reject"
              variant="danger"
              prompt="Why? The vendor sees this."
              run={decideListingAction.bind(null, listing.id, "rejected")}
            />
          </>
        ) : null}

        {listing.status === "approved" ? (
          <ActionButton
            label="Take it down"
            variant="danger"
            confirm="Hide this listing? Customers stop seeing it immediately."
            run={decideListingAction.bind(null, listing.id, "hidden")}
          />
        ) : null}

        {listing.status === "hidden" || listing.status === "rejected" ? (
          <ActionButton
            label="Put it back"
            variant="primary"
            run={restoreListingAction.bind(null, listing.id)}
          />
        ) : null}
      </div>
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

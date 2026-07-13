import { requireView, PERMISSIONS as P } from "@/modules/admin";
import { listingQueue } from "@/modules/admin";
import { decideListingAction } from "@/modules/admin/actions";
import { formatKobo } from "@/lib/money";
import { Card, PageHeader } from "@/components/ui";
import { ActionButton } from "../action-button";

/** Listing approval queue. */
export default async function ListingsQueuePage() {
  await requireView(P.listingsView);
  const queue = await listingQueue();

  return (
    <>
      <PageHeader title="Listing approvals" subtitle="Nothing is public until it clears this queue." />

      {queue.length === 0 ? (
        <Card className="text-sm text-[color:var(--color-ink-muted)]">Nothing waiting for approval.</Card>
      ) : (
        <ul className="space-y-3">
          {queue.map((l) => (
            <li key={l.id}>
              <Card>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium">{l.title}</p>
                    <p className="mt-0.5 text-xs text-[color:var(--color-ink-muted)]">
                      {(l.providers as unknown as { business_name: string } | null)?.business_name} ·{" "}
                      {(l.categories as unknown as { name: string } | null)?.name}
                    </p>
                  </div>
                  <p className="text-sm tabular-nums">
                    {l.price_type === "fixed" && l.price_kobo != null ? formatKobo(l.price_kobo) : "On request"}
                  </p>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <ActionButton label="Approve" variant="primary" run={decideListingAction.bind(null, l.id, "approved")} />
                  <ActionButton label="Request changes" prompt="What needs changing?" run={decideListingAction.bind(null, l.id, "changes_requested")} />
                  <ActionButton label="Reject" variant="danger" prompt="Reason:" run={decideListingAction.bind(null, l.id, "rejected")} />
                  <ActionButton label="Hide" run={decideListingAction.bind(null, l.id, "hidden")} />
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

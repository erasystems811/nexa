import Link from "next/link";
import type { Route } from "next";
import { requireView, PERMISSIONS as P } from "@/modules/admin";
import { listingQueue, listAllListings } from "@/modules/admin";
import { decideListingAction, restoreListingAction } from "@/modules/admin/actions";
import { formatKobo } from "@/lib/money";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ActionButton } from "../action-button";

/**
 * Listings.
 *
 * This page used to show only what was WAITING, which meant that approving a
 * listing made it disappear — off the queue, and off the face of Nexa as far as
 * the admin could tell. There was no screen anywhere that could answer "what is
 * actually live?", and no way back to a listing you had just approved.
 */

const TABS = [
  { key: "", label: "Waiting" },
  { key: "approved", label: "Live" },
  { key: "changes_requested", label: "Changes asked for" },
  { key: "hidden", label: "Hidden" },
  { key: "rejected", label: "Rejected" },
  { key: "all", label: "Everything" },
] as const;

const STATUS_LABEL: Record<string, string> = {
  pending_approval: "Waiting for you",
  approved: "Live",
  changes_requested: "Changes asked for",
  hidden: "Hidden",
  rejected: "Rejected",
  draft: "Draft",
  paused: "Paused",
};

export default async function ListingsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  await requireView(P.listingsView);
  const { status } = await searchParams;

  const [listings, waiting] = await Promise.all([
    !status ? listingQueue() : listAllListings(status === "all" ? undefined : status),
    listingQueue(),
  ]);

  return (
    <>
      <h1 className="font-serif text-2xl font-bold">Listings</h1>
      <p className="mt-1 text-sm text-muted-foreground">Nothing a vendor writes is public until you have approved it.</p>

      <div className="mb-4 mt-6 flex flex-wrap gap-2">
        {TABS.map((t) => (
          <Tab
            key={t.key}
            label={t.label}
            count={t.key === "" ? waiting.length : undefined}
            href={(t.key ? `/listings?status=${t.key}` : "/listings") as Route}
            active={(status ?? "") === t.key}
          />
        ))}
      </div>

      {listings.length === 0 ? (
        <Card>
          <CardContent className="pt-6 text-sm text-muted-foreground">
            {status ? "Nothing here." : "Nothing waiting for you."}
          </CardContent>
        </Card>
      ) : (
        <ul className="space-y-3">
          {listings.map((l) => {
            const provider = (l.providers as unknown as { business_name: string } | null)?.business_name;
            const isLive = l.status === "approved";

            return (
              <li key={l.id}>
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <Link href={`/listings/${l.id}` as Route} className="text-sm font-medium underline-offset-2 hover:underline">
                          {l.title}
                        </Link>
                        <p className="mt-0.5 text-xs text-muted-foreground">{provider ?? "Unknown vendor"}</p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-sm tabular-nums">
                          {l.price_type === "fixed" && l.price_kobo != null ? formatKobo(l.price_kobo) : "On request"}
                        </p>
                        <span
                          className={`mt-1 inline-block rounded-full px-2.5 py-0.5 text-[11px] font-medium ${
                            isLive ? "bg-emerald-50 text-emerald-700" : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {STATUS_LABEL[l.status] ?? l.status}
                        </span>
                      </div>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2">
                      <Link href={`/listings/${l.id}` as Route}>
                        <Button variant="outline" size="sm">
                          Open &amp; inspect
                        </Button>
                      </Link>

                      {l.status === "pending_approval" || l.status === "changes_requested" ? (
                        <ActionButton label="Approve — put it live" variant="primary" run={decideListingAction.bind(null, l.id, "approved")} />
                      ) : null}

                      {l.status === "pending_approval" ? (
                        <>
                          <ActionButton
                            label="Ask for changes"
                            prompt="What needs changing? The vendor sees this."
                            run={decideListingAction.bind(null, l.id, "changes_requested")}
                          />
                          <ActionButton label="Reject" variant="danger" prompt="Why? The vendor sees this." run={decideListingAction.bind(null, l.id, "rejected")} />
                        </>
                      ) : null}

                      {isLive ? (
                        <ActionButton
                          label="Take it down"
                          variant="danger"
                          confirm="Hide this listing? Customers stop seeing it immediately."
                          run={decideListingAction.bind(null, l.id, "hidden")}
                        />
                      ) : null}

                      {l.status === "hidden" || l.status === "rejected" ? (
                        <ActionButton label="Put it back" variant="primary" run={restoreListingAction.bind(null, l.id)} />
                      ) : null}
                    </div>
                  </CardContent>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}

function Tab({ label, href, active, count }: { label: string; href: Route; active: boolean; count?: number }) {
  return (
    <Link
      href={href}
      className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
        active ? "border-accent bg-accent text-accent-foreground" : "hover:border-muted-foreground"
      }`}
    >
      {label}
      {count ? (
        <span className={`ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${active ? "bg-white/20" : "bg-muted"}`}>
          {count}
        </span>
      ) : null}
    </Link>
  );
}

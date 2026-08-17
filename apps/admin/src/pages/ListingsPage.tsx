import { Link, useSearchParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { formatKobo } from "@nexa/money";
import { Card, CardContent } from "@nexa/design-system/src/components/ui/card";
import { Button } from "@nexa/design-system/src/components/ui/button";
import { apiSend } from "../lib/api";
import { useApiQuery } from "../lib/query";
import { useAuth } from "../auth/AuthContext";
import { PERMISSIONS as P, can } from "../lib/permissions";
import { ActionButton } from "../components/action-button";

interface ListingRow {
  id: string;
  title: string;
  status: string;
  price_type: string;
  price_kobo: number | null;
  created_at: string;
  providers: { business_name: string } | null;
  categories: { name: string } | null;
}

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

/**
 * Listings.
 *
 * This page used to show only what was WAITING, which meant that approving a
 * listing made it disappear — off the queue, and off the face of Nexa as far as
 * the admin could tell. There was no screen anywhere that could answer "what is
 * actually live?", and no way back to a listing you had just approved.
 */
export function ListingsPage() {
  const { staff } = useAuth();
  const [searchParams] = useSearchParams();
  const status = searchParams.get("status") ?? "";
  const queryClient = useQueryClient();

  const listingsKey = ["listings", status] as const;
  const { data: listings } = useApiQuery<ListingRow[]>(
    listingsKey,
    !status ? "/admin/listings/queue" : "/admin/listings",
    !status || status === "all" ? undefined : { status },
  );

  const waitingKey = ["listings-queue"] as const;
  const { data: waitingData } = useApiQuery<ListingRow[]>(waitingKey, "/admin/listings/queue");
  const waiting = waitingData ?? [];

  function reload() {
    queryClient.invalidateQueries({ queryKey: listingsKey });
    queryClient.invalidateQueries({ queryKey: waitingKey });
  }

  if (!can(staff, P.listingsView)) {
    return <p className="text-sm text-muted-foreground">You do not have permission to view listings.</p>;
  }

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
            href={t.key ? `/listings?status=${t.key}` : "/listings"}
            active={status === t.key}
          />
        ))}
      </div>

      {!listings ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : listings.length === 0 ? (
        <Card>
          <CardContent className="pt-6 text-sm text-muted-foreground">
            {status ? "Nothing here." : "Nothing waiting for you."}
          </CardContent>
        </Card>
      ) : (
        <ul className="space-y-3">
          {listings.map((l) => {
            const provider = l.providers?.business_name;
            const isLive = l.status === "approved";
            const canApprove = can(staff, P.listingsApprove);

            return (
              <li key={l.id}>
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <Link to={`/listings/${l.id}`} className="text-sm font-medium underline-offset-2 hover:underline">
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
                      <Link to={`/listings/${l.id}`}>
                        <Button variant="outline" size="sm">
                          Open &amp; inspect
                        </Button>
                      </Link>

                      {canApprove && (l.status === "pending_approval" || l.status === "changes_requested") ? (
                        <ActionButton
                          label="Approve — put it live"
                          variant="primary"
                          run={() => apiSend("POST", `/admin/listings/${l.id}/decide`, { decision: "approved" }).then(reload)}
                        />
                      ) : null}

                      {canApprove && l.status === "pending_approval" ? (
                        <>
                          <ActionButton
                            label="Ask for changes"
                            prompt="What needs changing? The vendor sees this."
                            run={(reason) =>
                              apiSend("POST", `/admin/listings/${l.id}/decide`, { decision: "changes_requested", reason }).then(
                                reload,
                              )
                            }
                          />
                          <ActionButton
                            label="Reject"
                            variant="danger"
                            prompt="Why? The vendor sees this."
                            run={(reason) =>
                              apiSend("POST", `/admin/listings/${l.id}/decide`, { decision: "rejected", reason }).then(reload)
                            }
                          />
                        </>
                      ) : null}

                      {canApprove && isLive ? (
                        <ActionButton
                          label="Take it down"
                          variant="danger"
                          confirm="Hide this listing? Customers stop seeing it immediately."
                          run={() => apiSend("POST", `/admin/listings/${l.id}/decide`, { decision: "hidden" }).then(reload)}
                        />
                      ) : null}

                      {canApprove && (l.status === "hidden" || l.status === "rejected") ? (
                        <ActionButton
                          label="Put it back"
                          variant="primary"
                          run={() => apiSend("POST", `/admin/listings/${l.id}/restore`).then(reload)}
                        />
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

function Tab({ label, href, active, count }: { label: string; href: string; active: boolean; count?: number }) {
  return (
    <Link
      to={href}
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

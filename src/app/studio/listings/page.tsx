import Link from "next/link";
import type { Route } from "next";
import { requireProvider, listMyListings } from "@/modules/provider";
import { formatKobo } from "@/lib/money";
import { Card, PageHeader } from "@/components/ui";

const STATUS_LABEL: Record<string, string> = {
  draft: "Draft",
  pending_approval: "Pending approval",
  approved: "Live",
  rejected: "Rejected",
  changes_requested: "Changes requested",
  paused: "Paused",
  hidden: "Hidden by Admin",
};

/** Listings. */
export default async function StudioListings() {
  const provider = await requireProvider();
  const listings = await listMyListings(provider.id);

  return (
    <>
      <div className="mb-6 flex items-center justify-between">
        <PageHeader title="Listings" />
        <Link
          href={"/listings/new" as Route}
          className="h-10 shrink-0 rounded-full bg-[color:var(--color-ink)] px-5 text-sm font-medium leading-10 text-white"
        >
          New listing
        </Link>
      </div>

      {listings.length === 0 ? (
        <Card className="text-sm text-[color:var(--color-ink-muted)]">
          No listings yet. Create one — it goes to Admin for approval before it&rsquo;s public.
        </Card>
      ) : (
        <ul className="space-y-3">
          {listings.map((l) => (
            <li key={l.id}>
              <Link href={`/listings/${l.id}` as Route}>
                <Card className="flex items-center justify-between">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{l.title}</p>
                    <p className="mt-0.5 text-xs text-[color:var(--color-ink-muted)]">
                      {l.categories?.name} · {l.price_type === "fixed" ? "Fixed" : "Negotiable"}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <span className="text-[11px] font-medium text-[color:var(--color-ink-muted)]">
                      {STATUS_LABEL[l.status] ?? l.status}
                    </span>
                    <p className="text-sm tabular-nums">
                      {l.price_type === "fixed" && l.price_kobo !== null
                        ? formatKobo(l.price_kobo)
                        : "On request"}
                    </p>
                  </div>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

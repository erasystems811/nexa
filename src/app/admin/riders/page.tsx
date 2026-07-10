import Link from "next/link";
import type { Route } from "next";
import { requireView, PERMISSIONS as P } from "@/modules/admin";
import { listRiders } from "@/modules/admin";
import { Card, PageHeader } from "@/components/ui";

const STATUSES = ["pending", "approved", "suspended", "rejected"] as const;

/** Rider management. PRD Sections 12, 15. */
export default async function RidersPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  await requireView(P.ridersView);
  const { status } = await searchParams;
  const riders = await listRiders(status);

  return (
    <>
      <PageHeader title="Riders" />
      <div className="mb-4 flex flex-wrap gap-2">
        <Filter label="All" href="/admin/riders" active={!status} />
        {STATUSES.map((s) => (
          <Filter key={s} label={s} href={`/admin/riders?status=${s}` as Route} active={status === s} />
        ))}
      </div>
      <ul className="space-y-2">
        {riders.map((r) => (
          <li key={r.id}>
            <Link href={`/admin/riders/${r.id}`}>
              <Card className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">{r.full_name}</p>
                  <p className="mt-0.5 text-xs text-[color:var(--color-ink-muted)] capitalize">
                    {r.vehicle_type}{r.vehicle_plate ? ` · ${r.vehicle_plate}` : ""} · {r.cities?.name ?? "—"}
                  </p>
                </div>
                <span className="rounded-full bg-[color:var(--color-surface-sunk)] px-2.5 py-1 text-[11px] font-medium capitalize">{r.status}</span>
              </Card>
            </Link>
          </li>
        ))}
        {riders.length === 0 ? <Card className="text-sm text-[color:var(--color-ink-muted)]">No riders here.</Card> : null}
      </ul>
    </>
  );
}

function Filter({ label, href, active }: { label: string; href: Route; active: boolean }) {
  return (
    <Link href={href} className={`rounded-full border px-3 py-1.5 text-xs capitalize ${active ? "border-[color:var(--color-ink)] bg-[color:var(--color-ink)] text-white" : "border-[color:var(--color-line)]"}`}>
      {label}
    </Link>
  );
}

import Link from "next/link";
import type { Route } from "next";
import { requireView, PERMISSIONS as P } from "@/modules/admin";
import { listProviders } from "@/modules/admin";
import { Card, PageHeader } from "@/components/ui";
import { AddProvider } from "./add-provider";

const STATUSES = ["pending", "approved", "suspended", "rejected", "removed"] as const;

const STATUS_LABEL: Record<string, string> = {
  changes_requested: "Changes requested",
  pending: "Waiting for approval",
  approved: "Approved",
  suspended: "Suspended",
  rejected: "Rejected",
  removed: "Removed",
};

/** Vendors. */
export default async function ProvidersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  await requireView(P.providersView);
  const { status } = await searchParams;
  const providers = await listProviders(status);

  return (
    <>
      <PageHeader title="Vendors" subtitle="The businesses selling on Nexa." />

      <div className="mb-4 flex flex-wrap gap-2">
        <FilterLink label="All" href={"/providers" as Route} active={!status} />
        {STATUSES.map((s) => (
          <FilterLink key={s} label={STATUS_LABEL[s] ?? s} href={`/providers?status=${s}` as Route} active={status === s} />
        ))}
      </div>

      <AddProvider />

      <ul className="mt-4 space-y-2">
        {providers.map((p) => (
          <li key={p.id}>
            <Link href={`/providers/${p.id}` as Route}>
              <Card className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">{p.business_name}</p>
                  <p className="mt-0.5 text-xs text-[color:var(--color-ink-muted)]">
                    {p.cities?.name ?? "—"}
                    {p.strike_count > 0 ? ` · ${p.strike_count} strike${p.strike_count === 1 ? "" : "s"}` : ""}
                    {p.is_on_probation ? " · probation" : ""}
                  </p>
                </div>
                <span className="shrink-0 rounded-full bg-[color:var(--color-surface-sunk)] px-2.5 py-1 text-[11px] font-medium">
                  {STATUS_LABEL[p.status] ?? p.status}
                </span>
              </Card>
            </Link>
          </li>
        ))}
        {providers.length === 0 ? (
          <Card className="text-sm text-[color:var(--color-ink-muted)]">No vendors here.</Card>
        ) : null}
      </ul>
    </>
  );
}

function FilterLink({ label, href, active }: { label: string; href: Route; active: boolean }) {
  return (
    <Link
      href={href}
      className={`rounded-full border px-3 py-1.5 text-xs ${active ? "border-[color:var(--color-ink)] bg-[color:var(--color-ink)] text-white" : "border-[color:var(--color-line)]"}`}
    >
      {label}
    </Link>
  );
}

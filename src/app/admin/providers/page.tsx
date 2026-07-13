import Link from "next/link";
import type { Route } from "next";
import { requireView, PERMISSIONS as P } from "@/modules/admin";
import { listProviders } from "@/modules/admin";
import { Card, PageHeader } from "@/components/ui";
import { AddProvider } from "./add-provider";

const STATUSES = ["pending", "approved", "suspended", "rejected", "removed"] as const;

/** Provider management. PRD Section 12. */
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
      <PageHeader title="Providers" />

      <div className="mb-4 flex flex-wrap gap-2">
        <FilterLink label="All" href={"/providers" as Route} active={!status} />
        {STATUSES.map((s) => (
          <FilterLink key={s} label={s} href={`/providers?status=${s}` as Route} active={status === s} />
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
                <span className="rounded-full bg-[color:var(--color-surface-sunk)] px-2.5 py-1 text-[11px] font-medium capitalize">
                  {p.status}
                </span>
              </Card>
            </Link>
          </li>
        ))}
        {providers.length === 0 ? (
          <Card className="text-sm text-[color:var(--color-ink-muted)]">No providers here.</Card>
        ) : null}
      </ul>
    </>
  );
}

function FilterLink({ label, href, active }: { label: string; href: Route; active: boolean }) {
  return (
    <Link
      href={href}
      className={`rounded-full border px-3 py-1.5 text-xs capitalize ${active ? "border-[color:var(--color-ink)] bg-[color:var(--color-ink)] text-white" : "border-[color:var(--color-line)]"}`}
    >
      {label}
    </Link>
  );
}

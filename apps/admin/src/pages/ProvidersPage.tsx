import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Card, CardContent } from "@nexa/design-system/src/components/ui/card";
import { apiGet } from "../lib/api";
import { AddProvider } from "../components/add-provider";
import { useAuth } from "../auth/AuthContext";
import { PERMISSIONS as P, can } from "../lib/permissions";

const STATUSES = ["pending", "approved", "suspended", "rejected", "removed"] as const;

const STATUS_LABEL: Record<string, string> = {
  changes_requested: "Changes requested",
  pending: "Waiting for approval",
  approved: "Approved",
  suspended: "Suspended",
  rejected: "Rejected",
  removed: "Removed",
};

interface ProviderListItem {
  id: string;
  business_name: string;
  slug: string;
  status: string;
  is_featured: boolean;
  is_on_probation: boolean;
  strike_count: number;
  created_at: string;
  cities: { name: string } | null;
}

/** Vendors. */
export function ProvidersPage() {
  const { staff } = useAuth();
  const [searchParams] = useSearchParams();
  const status = searchParams.get("status") ?? undefined;
  const [providers, setProviders] = useState<ProviderListItem[] | null>(null);

  function load() {
    apiGet<ProviderListItem[]>("/admin/providers", status ? { status } : undefined).then(setProviders);
  }

  useEffect(load, [status]);

  if (!can(staff, P.providersView)) {
    return <p className="text-sm text-muted-foreground">You do not have permission to view vendors.</p>;
  }

  if (!providers) return <div className="text-muted-foreground">Loading…</div>;

  return (
    <>
      <h1 className="font-serif text-2xl font-bold">Vendors</h1>
      <p className="mt-1 text-sm text-muted-foreground">The businesses selling on Nexa.</p>

      {can(staff, P.providersApprove) ? (
        <div className="mt-4">
          <AddProvider onAdded={load} />
        </div>
      ) : null}

      <div className="mb-4 mt-4 flex flex-wrap gap-2">
        <FilterLink label="All" href="/providers" active={!status} />
        {STATUSES.map((s) => (
          <FilterLink key={s} label={STATUS_LABEL[s] ?? s} href={`/providers?status=${s}`} active={status === s} />
        ))}
      </div>

      <ul className="space-y-2">
        {providers.map((p) => (
          <li key={p.id}>
            <Link to={`/providers/${p.id}`}>
              <Card className="transition hover:border-primary/50">
                <CardContent className="flex items-center justify-between gap-3 py-4">
                  <div>
                    <p className="text-sm font-medium">{p.business_name}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {p.cities?.name ?? "—"}
                      {p.strike_count > 0 ? ` · ${p.strike_count} strike${p.strike_count === 1 ? "" : "s"}` : ""}
                      {p.is_on_probation ? " · probation" : ""}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-full bg-muted px-2.5 py-1 text-[11px] font-medium">
                    {STATUS_LABEL[p.status] ?? p.status}
                  </span>
                </CardContent>
              </Card>
            </Link>
          </li>
        ))}
        {providers.length === 0 ? (
          <Card>
            <CardContent className="pt-6 text-sm text-muted-foreground">No vendors here.</CardContent>
          </Card>
        ) : null}
      </ul>
    </>
  );
}

function FilterLink({ label, href, active }: { label: string; href: string; active: boolean }) {
  return (
    <Link
      to={href}
      className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
        active ? "border-accent bg-accent text-accent-foreground" : "hover:border-muted-foreground"
      }`}
    >
      {label}
    </Link>
  );
}

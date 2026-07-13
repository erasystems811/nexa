import { requireView, PERMISSIONS as P } from "@/modules/admin";
import { reports } from "@/modules/admin";
import { formatKobo } from "@/lib/money";
import { Card, PageHeader } from "@/components/ui";

/** Reports. */
export default async function ReportsPage() {
  await requireView(P.reportsView);
  const r = await reports();

  return (
    <>
      <PageHeader title="Reports" subtitle={`${r.completedCount} completed bookings.`} />

      <div className="grid gap-3 sm:grid-cols-2">
        <Card>
          <h2 className="text-sm font-semibold">Top providers</h2>
          {r.topProviders.length === 0 ? (
            <p className="mt-1 text-sm text-[color:var(--color-ink-muted)]">No completed bookings yet.</p>
          ) : (
            <ol className="mt-2 space-y-1 text-sm">
              {r.topProviders.map((p, i) => (
                <li key={i} className="flex justify-between">
                  <span>{i + 1}. {p.name}</span>
                  <span className="text-[color:var(--color-ink-muted)]">{p.count} · {formatKobo(p.revenue)}</span>
                </li>
              ))}
            </ol>
          )}
        </Card>

        <Card>
          <h2 className="text-sm font-semibold">Most-booked categories</h2>
          {r.topCategories.length === 0 ? (
            <p className="mt-1 text-sm text-[color:var(--color-ink-muted)]">Nothing yet.</p>
          ) : (
            <ol className="mt-2 space-y-1 text-sm">
              {r.topCategories.map((c, i) => (
                <li key={i} className="flex justify-between">
                  <span>{i + 1}. {c.name}</span>
                  <span className="text-[color:var(--color-ink-muted)]">{c.count}</span>
                </li>
              ))}
            </ol>
          )}
        </Card>
      </div>

      <Card className="mt-3">
        <h2 className="text-sm font-semibold">Commission by month</h2>
        {r.revenueByMonth.length === 0 ? (
          <p className="mt-1 text-sm text-[color:var(--color-ink-muted)]">No revenue yet.</p>
        ) : (
          <ul className="mt-2 space-y-1 text-sm">
            {r.revenueByMonth.map((m) => (
              <li key={m.month} className="flex justify-between">
                <span>{m.month}</span>
                <span className="tabular-nums">{formatKobo(m.kobo)}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}

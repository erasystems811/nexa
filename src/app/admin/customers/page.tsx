import Link from "next/link";
import type { Route } from "next";
import { requireView, PERMISSIONS as P } from "@/modules/admin";
import { listCustomers } from "@/modules/admin";
import { Card, PageHeader } from "@/components/ui";

/** Customer management. PRD Section 12. */
export default async function CustomersPage() {
  await requireView(P.customersView);
  const customers = await listCustomers();

  return (
    <>
      <PageHeader title="Customers" />
      <ul className="space-y-2">
        {customers.map((c) => (
          <li key={c.id}>
            <Link href={`/customers/${c.id}` as Route}>
              <Card className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">{c.full_name ?? "Unnamed"}</p>
                  <p className="mt-0.5 text-xs text-[color:var(--color-ink-muted)]">{c.phone ?? "—"}</p>
                </div>
                {c.is_suspended ? <span className="text-[11px] text-[color:var(--color-danger)]">suspended</span> : null}
              </Card>
            </Link>
          </li>
        ))}
        {customers.length === 0 ? <Card className="text-sm text-[color:var(--color-ink-muted)]">No customers yet.</Card> : null}
      </ul>
    </>
  );
}

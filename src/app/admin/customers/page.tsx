import Link from "next/link";
import type { Route } from "next";
import { requireView, PERMISSIONS as P } from "@/modules/admin";
import { listCustomers } from "@/modules/admin";
import { Card, CardContent } from "@/components/ui/card";

/** Customer management. */
export default async function CustomersPage() {
  await requireView(P.customersView);
  const customers = await listCustomers();

  return (
    <>
      <h1 className="font-serif text-2xl font-bold">Customers</h1>
      <ul className="mt-6 space-y-2">
        {customers.map((c) => (
          <li key={c.id}>
            <Link href={`/customers/${c.id}` as Route}>
              <Card className="transition hover:border-primary/50">
                <CardContent className="flex items-center justify-between gap-3 py-4">
                  <div>
                    <p className="text-sm font-medium">{c.full_name ?? "Unnamed"}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{c.phone ?? "—"}</p>
                  </div>
                  {c.is_suspended ? <span className="text-[11px] text-destructive">suspended</span> : null}
                </CardContent>
              </Card>
            </Link>
          </li>
        ))}
        {customers.length === 0 ? (
          <Card>
            <CardContent className="pt-6 text-sm text-muted-foreground">No customers yet.</CardContent>
          </Card>
        ) : null}
      </ul>
    </>
  );
}

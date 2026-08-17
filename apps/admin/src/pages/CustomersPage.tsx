import { Link } from "react-router-dom";
import { Card, CardContent } from "@nexa/design-system/src/components/ui/card";
import { useApiQuery } from "../lib/query";
import { useAuth } from "../auth/AuthContext";
import { PERMISSIONS as P, can } from "../lib/permissions";

interface CustomerListItem {
  id: string;
  full_name: string | null;
  phone: string | null;
  is_suspended: boolean;
  created_at: string;
}

/** Customer management. */
export function CustomersPage() {
  const { staff } = useAuth();
  const { data: customers } = useApiQuery<CustomerListItem[]>(["customers"], "/admin/customers");

  if (!can(staff, P.customersView)) {
    return <p className="text-sm text-muted-foreground">You do not have permission to view customers.</p>;
  }

  if (!customers) return <p className="text-sm text-muted-foreground">Loading…</p>;

  return (
    <>
      <h1 className="font-serif text-2xl font-bold">Customers</h1>
      <ul className="mt-6 space-y-2">
        {customers.map((c) => (
          <li key={c.id}>
            <Link to={`/customers/${c.id}`}>
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

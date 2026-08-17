import { Link } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@nexa/design-system/src/components/ui/card";
import { useApiQuery } from "../lib/query";
import { useAuth } from "../auth/AuthContext";
import { PERMISSIONS as P, STAFF_ROLE_LABELS, can, type StaffRole } from "../lib/permissions";
import { InviteStaff } from "../components/invite-staff";

interface StaffRow {
  id: string;
  staff_role: StaffRole;
  permissions: string[];
  status: string;
  last_login_at: string | null;
  email: string | null;
  profiles: { full_name: string | null } | null;
}

/** Staff & permissions. */
export function StaffPage() {
  const { staff } = useAuth();
  const queryClient = useQueryClient();
  const queryKey = ["staff"] as const;
  const { data: rows } = useApiQuery<StaffRow[]>(queryKey, "/admin/staff");
  const reload = () => queryClient.invalidateQueries({ queryKey });

  if (!can(staff, P.staffManage)) {
    return <p className="text-sm text-muted-foreground">You do not have permission to view staff.</p>;
  }

  if (!rows) return <div className="text-muted-foreground">Loading…</div>;

  return (
    <>
      <h1 className="font-serif text-2xl font-bold">Staff</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Every teammate has their own login. Assign roles; grant extra views per person.
      </p>

      <div className="mt-4">
        <InviteStaff onAdded={reload} />
      </div>

      <ul className="mt-4 space-y-2">
        {rows.map((m) => (
          <li key={m.id}>
            <Link to={`/staff/${m.id}`}>
              <Card className="transition hover:border-primary/50">
                <CardContent className="flex items-center justify-between gap-3 py-4">
                  <div>
                    <p className="text-sm font-medium">{m.profiles?.full_name ?? m.email ?? "Staff"}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {STAFF_ROLE_LABELS[m.staff_role]}
                      {m.staff_role !== "super_admin" ? ` · ${m.permissions.length} views` : " · all views"}
                      {m.last_login_at ? ` · last in ${new Date(m.last_login_at).toLocaleDateString("en-NG")}` : " · never signed in"}
                    </p>
                  </div>
                  {m.status === "suspended" ? <span className="text-[11px] text-destructive">suspended</span> : null}
                </CardContent>
              </Card>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}

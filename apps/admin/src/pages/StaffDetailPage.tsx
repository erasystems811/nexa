import { useParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@nexa/design-system/src/components/ui/card";
import { useApiQuery } from "../lib/query";
import { useAuth } from "../auth/AuthContext";
import {
  PERMISSIONS as P,
  PERMISSION_LABELS,
  ALL_PERMISSIONS,
  STAFF_ROLES,
  STAFF_ROLE_LABELS,
  can,
  type Permission,
  type StaffRole,
} from "../lib/permissions";
import { PermissionEditor } from "../components/permission-editor";
import { StaffControls } from "../components/staff-controls";

interface StaffLogin {
  event: string;
  ip_address: string | null;
  created_at: string;
}

interface StaffDetail {
  id: string;
  staff_role: StaffRole;
  status: string;
  permissions: Permission[];
  email: string | null;
  profiles: { full_name: string | null } | null;
  logins: StaffLogin[];
}

/** One staff member — role, per-view permissions, login history. */
export function StaffDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { staff } = useAuth();
  const queryClient = useQueryClient();
  const queryKey = ["staff-member", id] as const;
  const { data: m, error } = useApiQuery<StaffDetail>(queryKey, `/admin/staff/${id}`, undefined, {
    enabled: Boolean(id),
  });
  const notFound = Boolean(error);
  const reload = () => queryClient.invalidateQueries({ queryKey });

  if (!can(staff, P.staffManage)) {
    return <p className="text-sm text-muted-foreground">You do not have permission to view staff.</p>;
  }

  if (notFound) return <p className="text-sm text-muted-foreground">No such staff member.</p>;
  if (!m) return <div className="text-muted-foreground">Loading…</div>;

  const isSuper = m.staff_role === "super_admin";
  const held = new Set(m.permissions ?? []);

  return (
    <>
      <h1 className="font-serif text-2xl font-bold">{m.profiles?.full_name ?? m.email ?? "Staff"}</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {m.email ?? ""} · {STAFF_ROLE_LABELS[m.staff_role]}
        {m.status === "suspended" ? " · suspended" : ""}
      </p>

      <div className="mt-4">
        <StaffControls
          staffId={m.id}
          role={m.staff_role}
          status={m.status}
          roles={[...STAFF_ROLES]}
          roleLabels={STAFF_ROLE_LABELS}
          onChanged={reload}
        />
      </div>

      <Card className="mt-4">
        <CardContent className="pt-6">
          <h2 className="text-sm font-semibold">Views this person can access</h2>
          {isSuper ? (
            <p className="mt-2 text-sm text-muted-foreground">
              A Super Admin holds every view and permission. Change the role to grant a narrower set.
            </p>
          ) : (
            <>
              <p className="mt-1 text-xs text-muted-foreground">
                Assigning a role sets the starting bundle. Toggle any view on or off for this specific person.
              </p>
              <PermissionEditor
                staffId={m.id}
                permissions={ALL_PERMISSIONS.map((perm) => ({
                  key: perm,
                  label: PERMISSION_LABELS[perm],
                  held: held.has(perm),
                }))}
              />
            </>
          )}
        </CardContent>
      </Card>

      <Card className="mt-4">
        <CardContent className="pt-6">
          <h2 className="text-sm font-semibold">Login history</h2>
          {m.logins.length === 0 ? (
            <p className="mt-1 text-sm text-muted-foreground">No sign-ins recorded yet.</p>
          ) : (
            <ul className="mt-2 space-y-1 text-sm">
              {m.logins.map((l, i) => (
                <li key={i} className="flex justify-between">
                  <span className="text-muted-foreground">{l.event}</span>
                  <span>{new Date(l.created_at).toLocaleString("en-NG")}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card className="mt-4">
        <CardContent className="pt-6 text-xs text-muted-foreground">
          Every action this person takes is logged to their account. See it under{" "}
          <a href="/activity" className="underline">
            Activity
          </a>
          .
        </CardContent>
      </Card>
    </>
  );
}

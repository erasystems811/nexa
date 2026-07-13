import { notFound } from "next/navigation";
import {
  requireView, getStaffMember,
  PERMISSIONS as P, PERMISSION_LABELS, ALL_PERMISSIONS, STAFF_ROLES, STAFF_ROLE_LABELS,
  type Permission,
} from "@/modules/admin";
import { Card, PageHeader } from "@/components/ui";
import { PermissionEditor } from "./permission-editor";
import { StaffControls } from "./staff-controls";

/** One staff member — role, per-view permissions, login history. */
export default async function StaffMemberPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireView(P.staffManage);
  const m = await getStaffMember(id);
  if (!m) notFound();

  const isSuper = m.staff_role === "super_admin";
  const held = new Set((m.permissions as Permission[]) ?? []);

  return (
    <>
      <PageHeader
        title={(m.profiles as unknown as { full_name: string | null } | null)?.full_name ?? m.email ?? "Staff"}
        subtitle={`${m.email ?? ""} · ${STAFF_ROLE_LABELS[m.staff_role]}${m.status === "suspended" ? " · suspended" : ""}`}
      />

      <StaffControls staffId={m.id} role={m.staff_role} status={m.status} roles={[...STAFF_ROLES]} roleLabels={STAFF_ROLE_LABELS} />

      <Card className="mt-4">
        <h2 className="text-sm font-semibold">Views this person can access</h2>
        {isSuper ? (
          <p className="mt-2 text-sm text-[color:var(--color-ink-muted)]">
            A Super Admin holds every view and permission. Change the role to grant a narrower set.
          </p>
        ) : (
          <>
            <p className="mt-1 text-xs text-[color:var(--color-ink-muted)]">
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
      </Card>

      <Card className="mt-4">
        <h2 className="text-sm font-semibold">Login history</h2>
        {m.logins.length === 0 ? (
          <p className="mt-1 text-sm text-[color:var(--color-ink-muted)]">No sign-ins recorded yet.</p>
        ) : (
          <ul className="mt-2 space-y-1 text-sm">
            {m.logins.map((l, i) => (
              <li key={i} className="flex justify-between">
                <span className="text-[color:var(--color-ink-muted)]">{l.event}</span>
                <span>{new Date(l.created_at).toLocaleString("en-NG")}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="mt-4 text-xs text-[color:var(--color-ink-muted)]">
        Every action this person takes is logged to their account. See it under{" "}
        <a href="/activity" className="underline">Activity</a>.
      </Card>
    </>
  );
}

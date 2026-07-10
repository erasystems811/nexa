import Link from "next/link";
import { requireView, listStaff, PERMISSIONS as P, STAFF_ROLE_LABELS } from "@/modules/admin";
import { Card, PageHeader } from "@/components/ui";
import { InviteStaff } from "./invite-staff";

/** Staff & permissions. PRD Addendum v1.1 §4. */
export default async function StaffPage() {
  await requireView(P.staffManage);
  const staff = await listStaff();

  return (
    <>
      <PageHeader title="Staff" subtitle="Every teammate has their own login. Assign roles; grant extra views per person." />

      <InviteStaff />

      <ul className="mt-4 space-y-2">
        {staff.map((m) => (
          <li key={m.id}>
            <Link href={`/admin/staff/${m.id}`}>
              <Card className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">
                    {(m.profiles as unknown as { full_name: string | null } | null)?.full_name ?? m.email ?? "Staff"}
                  </p>
                  <p className="mt-0.5 text-xs text-[color:var(--color-ink-muted)]">
                    {STAFF_ROLE_LABELS[m.staff_role]}
                    {m.staff_role !== "super_admin" ? ` · ${m.permissions.length} views` : " · all views"}
                    {m.last_login_at ? ` · last in ${new Date(m.last_login_at).toLocaleDateString("en-NG")}` : " · never signed in"}
                  </p>
                </div>
                {m.status === "suspended" ? (
                  <span className="text-[11px] text-[color:var(--color-danger)]">suspended</span>
                ) : null}
              </Card>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}

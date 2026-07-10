import Link from "next/link";
import type { Route } from "next";
import { redirect } from "next/navigation";
import { requireSession, signOut } from "@/modules/auth";
import { currentStaff, recordLogin, can, PERMISSIONS as P } from "@/modules/admin";
import { Button } from "@/components/ui";
import type { Permission } from "@/modules/admin";

/** Nexa Admin Console. Internal staff only. PRD Section 12, Addendum §4. */
export default async function AdminLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  await requireSession();
  const staff = await currentStaff();
  if (!staff) redirect("/");

  // Record the visit as a login event (deduped to once per hour by last_login).
  await recordLogin(staff.userId).catch(() => {});

  // Each tab needs a permission; only tabs the staff member holds are shown.
  const tabs: { href: string; label: string; perm: Permission | null }[] = [
    { href: "/admin", label: "Home", perm: null },
    { href: "/admin/providers", label: "Providers", perm: P.providersView },
    { href: "/admin/riders", label: "Riders", perm: P.ridersView },
    { href: "/admin/listings", label: "Listings", perm: P.listingsView },
    { href: "/admin/orders", label: "Orders", perm: P.ordersView },
    { href: "/admin/payments", label: "Payments", perm: P.paymentsView },
    { href: "/admin/disputes", label: "Disputes", perm: P.disputesView },
    { href: "/admin/moderation", label: "Flags", perm: P.moderationView },
    { href: "/admin/customers", label: "Customers", perm: P.customersView },
    { href: "/admin/reports", label: "Reports", perm: P.reportsView },
    { href: "/admin/activity", label: "Activity", perm: P.staffManage },
    { href: "/admin/staff", label: "Staff", perm: P.staffManage },
    { href: "/admin/settings", label: "Settings", perm: P.settingsManage },
  ];
  const visible = tabs.filter((t) => t.perm === null || can(staff, t.perm));

  return (
    <div className="min-h-dvh bg-[color:var(--color-surface-sunk)]">
      <header className="border-b border-[color:var(--color-line)] bg-white">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-5 py-4">
          <Link href="/admin" className="text-sm font-semibold tracking-tight">
            Nexa Admin
          </Link>
          <form action={signOut}>
            <Button type="submit" variant="ghost" className="h-9 px-4 text-xs">
              Sign out
            </Button>
          </form>
        </div>
        <nav className="mx-auto max-w-4xl overflow-x-auto px-5">
          <ul className="flex gap-1 pb-2">
            {visible.map((t) => (
              <li key={t.href}>
                <Link
                  href={t.href as Route}
                  className="block whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium text-[color:var(--color-ink-muted)] hover:bg-[color:var(--color-surface-sunk)]"
                >
                  {t.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </header>

      <div className="mx-auto max-w-4xl px-5 py-8">{children}</div>
    </div>
  );
}

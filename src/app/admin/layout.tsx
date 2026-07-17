import Link from "next/link";
import { redirect } from "next/navigation";
import { requireSession, signOut } from "@/modules/auth";
import { currentStaff, recordLogin, can, PERMISSIONS as P } from "@/modules/admin";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui";
import { AdminNavTabs } from "./nav-tabs";
import type { Permission } from "@/modules/admin";

/** Nexa Admin Console. Internal staff only. */
export default async function AdminLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  await requireSession();
  const staff = await currentStaff();
  if (!staff) redirect("/");

  await recordLogin(staff.userId).catch(() => {});

  // Eight tabs, each one a thing a person actually does. Customers, staff, the
  // activity log and flagged messages are reachable from the page they belong
  // to — they are not day-to-day work and do not earn a tab.
  const tabs: { href: string; label: string; perm: Permission | null }[] = [
    { href: "/", label: "Dashboard", perm: null },
    { href: "/providers", label: "Vendors", perm: P.providersView },
    { href: "/listings", label: "Listings", perm: P.listingsView },
    { href: "/orders", label: "Bookings", perm: P.ordersView },
    { href: "/payments", label: "Money", perm: P.paymentsView },
    { href: "/subscriptions", label: "Subscriptions", perm: P.subscriptionsView },
    { href: "/disputes", label: "Support", perm: P.disputesView },
    { href: "/categories", label: "Categories", perm: P.settingsManage },
    { href: "/settings", label: "Settings", perm: P.settingsManage },
  ];
  const visible = tabs.filter((t) => t.perm === null || can(staff, t.perm));

  return (
    <div className="min-h-dvh bg-[color:var(--color-surface-sunk)]">
      <header className="sticky top-0 z-20 border-b border-[color:var(--color-line)]/60 bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-5 py-4">
          <Link href="/" aria-label="Nexa Admin home">
            <Logo label="Nexa Admin" markClassName="size-8 rounded-xl" textClassName="text-sm" />
          </Link>
          <form action={signOut}>
            <Button type="submit" variant="ghost" className="h-9 px-4 text-xs">
              Sign out
            </Button>
          </form>
        </div>
        <AdminNavTabs tabs={visible} />
      </header>

      <div className="mx-auto max-w-4xl px-5 py-8">{children}</div>
    </div>
  );
}

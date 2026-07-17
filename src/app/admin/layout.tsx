import { redirect } from "next/navigation";
import { requireSession, signOut } from "@/modules/auth";
import { currentStaff, recordLogin, can, PERMISSIONS as P } from "@/modules/admin";
import { AdminSidebar } from "./sidebar";
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
    <div className="admin-shell flex flex-col md:flex-row">
      <AdminSidebar tabs={visible} signOutAction={signOut} />
      <div className="flex min-h-dvh min-w-0 flex-1 flex-col">
        <div className="mx-auto w-full max-w-5xl flex-1 px-5 py-8 md:px-8">{children}</div>
      </div>
    </div>
  );
}

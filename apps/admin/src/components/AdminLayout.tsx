import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { AdminShell } from "./AdminShell";
import { PERMISSIONS as P, can, type Permission } from "../lib/permissions";

/** Nexa Admin Console. Internal staff only. */
export function AdminLayout() {
  const { loading, staffLoading, session, staff, signOut } = useAuth();

  // staffLoading covers the gap right after sign-in where `session` is
  // already set but the /admin/me fetch hasn't resolved yet — without this,
  // this guard reads "no staff yet" as "not staff", bounces to /login, which
  // immediately bounces back here since `session` is set, forever.
  if (loading || staffLoading) {
    return <div className="flex min-h-screen items-center justify-center text-muted-foreground">Loading…</div>;
  }
  if (!session) return <Navigate to="/login" replace />;

  // Signed in, but not (or no longer) a staff member. This must NOT redirect
  // to /login — session is valid, so /login would immediately bounce back
  // here, and this state bounce forever ("Maximum update depth exceeded").
  // Signing in again can't fix "you're not staff" anyway.
  if (!staff) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 text-center">
        <p className="text-muted-foreground">This account does not have Admin Console access.</p>
        <button type="button" onClick={signOut} className="text-sm underline">
          Sign out
        </button>
      </div>
    );
  }

  // Nine tabs, each one a thing a person actually does. Customers, staff, the
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
  const visible = tabs.filter((t) => t.perm === null || can(staff, t.perm)).map((t) => ({ href: t.href, label: t.label }));

  return (
    <AdminShell roleLabel="Admin" navItems={visible} onSignOut={signOut}>
      <Outlet />
    </AdminShell>
  );
}

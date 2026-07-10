import Link from "next/link";
import { requireRole, signOut } from "@/modules/auth";
import { Button } from "@/components/ui";

/** Nexa Admin Console. Internal ops team only. PRD Sections 02, 12. */
export default async function AdminLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  await requireRole("admin");

  const tabs = [
    { href: "/admin", label: "Home" },
    { href: "/admin/providers", label: "Providers" },
    { href: "/admin/riders", label: "Riders" },
    { href: "/admin/listings", label: "Listings" },
    { href: "/admin/orders", label: "Orders" },
    { href: "/admin/payments", label: "Payments" },
    { href: "/admin/disputes", label: "Disputes" },
    { href: "/admin/moderation", label: "Flags" },
    { href: "/admin/customers", label: "Customers" },
    { href: "/admin/reports", label: "Reports" },
    { href: "/admin/settings", label: "Settings" },
  ] as const;

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
            {tabs.map((t) => (
              <li key={t.href}>
                <Link
                  href={t.href}
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

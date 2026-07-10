import Link from "next/link";
import { requireRole, signOut } from "@/modules/auth";
import { Button } from "@/components/ui";

/** Nexa Admin Console. Internal ops team only. PRD Sections 02, 12. */
export default async function AdminLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  await requireRole("admin");

  return (
    <div className="min-h-dvh bg-[color:var(--color-surface-sunk)]">
      <header className="border-b border-[color:var(--color-line)] bg-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-5 py-4">
          <Link href="/admin" className="text-sm font-semibold tracking-tight">
            Nexa Admin
          </Link>
          <nav className="flex items-center gap-4 text-sm">
            <Link href="/admin/settings" className="underline">
              Settings
            </Link>
            <form action={signOut}>
              <Button type="submit" variant="ghost" className="h-9 px-4 text-xs">
                Sign out
              </Button>
            </form>
          </nav>
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-5 py-8">{children}</div>
    </div>
  );
}

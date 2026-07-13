import Link from "next/link";
import type { Route } from "next";
import { requireRole, signOut } from "@/modules/auth";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui";

/** Nexa Business Studio. PRD Section 13. Never "Vendor Portal" (Section 16). */
export default async function StudioLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  await requireRole("provider");

  const tabs = [
    { href: "/", label: "Home" },
    { href: "/listings", label: "Listings" },
    { href: "/orders", label: "Orders" },
    { href: "/wallet", label: "Wallet" },
    { href: "/reviews", label: "Reviews" },
    { href: "/profile", label: "Profile" },
  ] as const;

  return (
    <div className="min-h-dvh bg-[color:var(--color-surface-sunk)] pb-20">
      <header className="border-b border-[color:var(--color-line)] bg-white">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-5 py-4">
          <Link href="/" aria-label="Business Studio home">
            <Logo label="Business Studio" markClassName="size-8 rounded-xl" textClassName="text-sm" />
          </Link>
          <div className="flex items-center gap-3">
            <form action={signOut}>
              <Button type="submit" variant="ghost" className="h-9 px-4 text-xs">
                Sign out
              </Button>
            </form>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-2xl px-5 py-6">{children}</div>

      {/* Mobile-first: a bottom tab bar, the way Section 16 asks. */}
      <nav className="fixed inset-x-0 bottom-0 z-10 border-t border-[color:var(--color-line)] bg-white">
        <ul className="mx-auto flex max-w-2xl">
          {tabs.map((t) => (
            <li key={t.href} className="flex-1">
              <Link
                href={t.href as Route}
                className="block py-3 text-center text-[11px] font-medium text-[color:var(--color-ink-muted)]"
              >
                {t.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}

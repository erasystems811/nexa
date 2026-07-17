"use client";

import Link from "next/link";
import type { Route } from "next";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/", label: "Home" },
  { href: "/listings", label: "Listings" },
  { href: "/orders", label: "Orders" },
  { href: "/wallet", label: "Wallet" },
  { href: "/reviews", label: "Reviews" },
  { href: "/profile", label: "Profile" },
] as const;

/**
 * The bottom tab bar had no active state at all — every tab read identically
 * regardless of which page you were on, so there was no way to tell where you
 * were without looking at the page title. A client component because knowing
 * "which tab is this" needs the current path, which a server layout doesn't have.
 */
export function StudioTabBar() {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-10 border-t border-[color:var(--color-line)] bg-white/90 backdrop-blur-md">
      <ul className="mx-auto flex max-w-2xl">
        {TABS.map((t) => {
          const active = t.href === "/" ? pathname === "/studio" || pathname === "/" : pathname.startsWith(t.href);
          return (
            <li key={t.href} className="flex-1">
              <Link
                href={t.href as Route}
                className={`flex flex-col items-center gap-1 py-3 text-center text-[11px] font-medium transition-colors active:scale-95 ${
                  active ? "text-[color:var(--color-accent)]" : "text-[color:var(--color-ink-muted)]"
                }`}
              >
                <span
                  className={`h-1 w-5 rounded-full transition-colors ${active ? "bg-[color:var(--color-accent)]" : "bg-transparent"}`}
                  aria-hidden
                />
                {t.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

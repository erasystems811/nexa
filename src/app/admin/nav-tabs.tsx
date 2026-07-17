"use client";

import Link from "next/link";
import type { Route } from "next";
import { usePathname } from "next/navigation";

/**
 * Same problem as the Studio tab bar: every tab looked identical no matter
 * which section you were in. A client component because "which tab is this"
 * needs the current path.
 */
export function AdminNavTabs({ tabs }: { tabs: { href: string; label: string }[] }) {
  const pathname = usePathname();

  return (
    <nav className="mx-auto max-w-4xl overflow-x-auto px-5">
      <ul className="flex gap-1 pb-2">
        {tabs.map((t) => {
          const active = t.href === "/" ? pathname === "/admin" || pathname === "/" : pathname.startsWith(t.href);
          return (
            <li key={t.href}>
              <Link
                href={t.href as Route}
                className={`block whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium transition-colors active:scale-95 ${
                  active
                    ? "bg-[color:var(--color-accent)] text-white"
                    : "text-[color:var(--color-ink-muted)] hover:bg-[color:var(--color-surface-sunk)]"
                }`}
              >
                {t.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Route } from "next";
import type { Surface } from "@/lib/surfaces";

/**
 * The customer app's bottom tab bar — Home, Search, Orders.
 *
 * Only the customer marketplace gets it: Studio and Admin are their own apps with
 * their own chrome. It also stays out of the way on focused, full-screen flows
 * (sign-in, checkout, a WhatsApp thread) where a tab bar would only distract.
 *
 * A trailing spacer of the bar's own height rides along, so the last of a page's
 * content can always scroll clear of the fixed bar instead of hiding behind it.
 */

const TABS: { href: Route; label: string; icon: (active: boolean) => React.ReactNode }[] = [
  { href: "/" as Route, label: "Home", icon: (a) => <HomeIcon filled={a} /> },
  { href: "/search" as Route, label: "Search", icon: () => <SearchIcon /> },
  { href: "/orders" as Route, label: "Orders", icon: (a) => <OrdersIcon filled={a} /> },
];

// Paths that are their own app or a focused flow — no tab bar.
const HIDE = ["/login", "/register", "/reset", "/verify", "/apply", "/studio", "/admin", "/whatsapp", "/book"];

export function BottomNav({ surface }: { surface: Surface | null }) {
  const pathname = usePathname();

  // Studio / Admin subdomains are not the customer app. (In single-host mode the
  // surface is null and the path-based HIDE list below does the same job.)
  if (surface !== "customer" && surface !== null) return null;
  if (HIDE.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return null;

  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  return (
    <>
      <div className="h-[4.25rem]" aria-hidden />
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-[color:var(--color-line)] bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-3xl items-stretch justify-around pb-[env(safe-area-inset-bottom)]">
          {TABS.map((tab) => {
            const active = isActive(tab.href);
            return (
              <Link
                key={tab.href}
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={`flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] font-medium transition-colors ${
                  active
                    ? "text-[color:var(--color-accent)]"
                    : "text-[color:var(--color-ink-muted)] hover:text-[color:var(--color-ink)]"
                }`}
              >
                {tab.icon(active)}
                {tab.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}

function HomeIcon({ filled }: { filled: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5 9.5V21h14V9.5" fill={filled ? "currentColor" : "none"} />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.2-3.2" />
    </svg>
  );
}

function OrdersIcon({ filled }: { filled: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M6 2h9l3 3v17l-2.5-1.5L13 22l-2.5-1.5L8 22l-2-1.5V2Z" />
      <path d="M9 7h6M9 11h6M9 15h4" stroke={filled ? "white" : "currentColor"} />
    </svg>
  );
}

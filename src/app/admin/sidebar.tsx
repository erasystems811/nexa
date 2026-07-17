"use client";

import Link from "next/link";
import type { Route } from "next";
import { useState } from "react";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Store,
  Tags,
  CalendarCheck,
  Wallet,
  Repeat,
  LifeBuoy,
  FolderTree,
  Settings,
  Menu,
  X,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  Dashboard: LayoutDashboard,
  Vendors: Store,
  Listings: Tags,
  Bookings: CalendarCheck,
  Money: Wallet,
  Subscriptions: Repeat,
  Support: LifeBuoy,
  Categories: FolderTree,
  Settings: Settings,
};

const SUB: Record<string, string> = {
  Dashboard: "Overview & stats",
  Vendors: "Applications & profiles",
  Listings: "What's for sale",
  Bookings: "Orders in flight",
  Money: "Payouts & releases",
  Subscriptions: "Billing status",
  Support: "Disputes & flags",
  Categories: "Service taxonomy",
  Settings: "Fees & flags",
};

const SIDEBAR_KEY = "nexa_admin_sidebar";

export function AdminSidebar({
  tabs,
  signOutAction,
}: {
  tabs: { href: string; label: string }[];
  signOutAction: () => Promise<void>;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(() => {
    if (typeof window === "undefined") return true;
    try {
      return window.localStorage.getItem(SIDEBAR_KEY) !== "0";
    } catch {
      return true;
    }
  });
  const [mobileOpen, setMobileOpen] = useState(false);

  const toggle = () =>
    setOpen((v) => {
      const next = !v;
      try {
        window.localStorage.setItem(SIDEBAR_KEY, next ? "1" : "0");
      } catch {
        /* */
      }
      return next;
    });

  const isActive = (href: string) =>
    href === "/" ? pathname === "/admin" || pathname === "/" : pathname.startsWith(href);

  function NavList({ expanded }: { expanded: boolean }) {
    return (
      <nav className={expanded ? "flex-1 space-y-0.5 overflow-y-auto px-3 py-3" : "flex-1 space-y-1 overflow-y-auto px-2 py-3"}>
        {tabs.map((t) => {
          const Icon = ICONS[t.label] ?? LayoutDashboard;
          const active = isActive(t.href);
          return (
            <Link
              key={t.href}
              href={t.href as Route}
              onClick={() => setMobileOpen(false)}
              title={!expanded ? t.label : undefined}
              className={`flex items-center rounded-xl transition-all duration-150 active:scale-[0.98] ${
                expanded ? "gap-3 px-3 py-2.5" : "justify-center p-2.5"
              } ${
                active
                  ? "bg-[color:var(--color-accent-soft)] text-[color:var(--color-accent)]"
                  : "text-[color:var(--color-ink-muted)] hover:bg-white/5 hover:text-[color:var(--color-ink)]"
              }`}
            >
              <Icon className="size-4 shrink-0" />
              {expanded ? (
                <div className="min-w-0 flex-1 text-left">
                  <p className="text-sm font-medium leading-tight">{t.label}</p>
                  <p className="mt-0.5 truncate text-[11px] leading-tight text-[color:var(--color-ink-muted)]/70">
                    {SUB[t.label] ?? ""}
                  </p>
                </div>
              ) : null}
            </Link>
          );
        })}
      </nav>
    );
  }

  return (
    <>
      {/* Desktop sidebar */}
      <aside
        className="hidden shrink-0 flex-col border-r border-[color:var(--color-line)] transition-all duration-200 md:flex"
        style={{ width: open ? 216 : 56, background: "var(--color-surface)" }}
      >
        <div className={`flex h-14 shrink-0 items-center border-b border-[color:var(--color-line)] ${open ? "justify-between px-4" : "justify-center"}`}>
          {open ? (
            <>
              <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-[color:var(--color-ink-muted)]">
                Nexa Admin
              </span>
              <button
                onClick={toggle}
                className="rounded-lg p-1 text-[color:var(--color-ink-muted)]/50 transition hover:text-[color:var(--color-ink-muted)]"
                aria-label="Collapse sidebar"
              >
                <PanelLeftClose className="size-3.5" />
              </button>
            </>
          ) : (
            <button
              onClick={toggle}
              className="rounded-lg p-1.5 text-[color:var(--color-ink-muted)]/50 transition hover:text-[color:var(--color-ink-muted)]"
              aria-label="Expand sidebar"
            >
              <PanelLeftOpen className="size-3.5" />
            </button>
          )}
        </div>

        <NavList expanded={open} />

        <div className="border-t border-[color:var(--color-line)] p-3">
          <form action={signOutAction}>
            <button
              type="submit"
              title={!open ? "Sign out" : undefined}
              className={`flex w-full items-center rounded-xl text-[color:var(--color-ink-muted)] transition hover:bg-white/5 hover:text-[color:var(--color-ink)] ${
                open ? "gap-3 px-3 py-2" : "justify-center p-2.5"
              }`}
            >
              <LogOut className="size-4 shrink-0" />
              {open ? <span className="text-sm font-medium">Sign out</span> : null}
            </button>
          </form>
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-[color:var(--color-line)] px-4 md:hidden" style={{ background: "var(--color-surface)" }}>
        <button
          onClick={() => setMobileOpen(true)}
          className="rounded-lg p-1.5 text-[color:var(--color-ink-muted)]"
          aria-label="Open menu"
        >
          <Menu className="size-5" />
        </button>
        <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-[color:var(--color-ink-muted)]">
          Nexa Admin
        </span>
      </header>

      {/* Mobile drawer */}
      {mobileOpen ? (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={() => setMobileOpen(false)} />
          <aside className="absolute left-0 top-0 flex h-full w-64 flex-col" style={{ background: "var(--color-surface)" }}>
            <div className="flex h-14 shrink-0 items-center justify-between border-b border-[color:var(--color-line)] px-4">
              <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-[color:var(--color-ink-muted)]">
                Nexa Admin
              </span>
              <button onClick={() => setMobileOpen(false)} className="rounded-lg p-1.5 text-[color:var(--color-ink-muted)]">
                <X className="size-4" />
              </button>
            </div>
            <NavList expanded={true} />
            <div className="border-t border-[color:var(--color-line)] p-3">
              <form action={signOutAction}>
                <button
                  type="submit"
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-[color:var(--color-ink-muted)] transition hover:bg-white/5 hover:text-[color:var(--color-ink)]"
                >
                  <LogOut className="size-4 shrink-0" />
                  <span className="text-sm font-medium">Sign out</span>
                </button>
              </form>
            </div>
          </aside>
        </div>
      ) : null}
    </>
  );
}

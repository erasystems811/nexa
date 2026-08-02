"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { Route } from "next";
import { usePathname } from "next/navigation";
import {
  LogOut,
  Home,
  User,
  Search,
  FileText,
  Star,
  DollarSign,
  Users,
  Briefcase,
  Settings,
  Activity,
  Tags,
  Repeat,
  FolderTree,
  CreditCard,
  Menu,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Desktop chrome (md and up) is ported from the Event-Escrow-Nexus reference
 * (src/components/shells.tsx) as-is: fixed 256px sidebar, vertical nav.
 *
 * The reference's own mobile behavior — the nav collapsing into a horizontal
 * scroll strip inside the stacked sidebar, with the user/sign-out footer
 * hidden entirely (`hidden md:block`) — doesn't hold up on a phone: nav items
 * scroll off-screen (Vendor has 6, Admin has 9) and there is no way to sign
 * out. Below md we swap in a slim top bar + slide-in drawer instead, reusing
 * the same nav data and the same visual language.
 */

type NavItem = { label: string; href: string; icon: React.ComponentType<{ className?: string }> };

function NavLinks({
  items,
  onNavigate,
}: {
  items: Array<NavItem & { active: boolean }>;
  onNavigate?: () => void;
}) {
  return (
    <>
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href as Route}
          onClick={onNavigate}
          className={cn(
            "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors",
            item.active
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground hover:bg-secondary/50",
          )}
        >
          <item.icon className="size-4 shrink-0" />
          {item.label}
        </Link>
      ))}
    </>
  );
}

/** Slide-in nav drawer for mobile, plus the hamburger top bar that opens it. */
function MobileNav({
  brand,
  badgeLabel,
  badgeClassName,
  headerClassName,
  navItems,
  footer,
}: {
  brand: React.ReactNode;
  badgeLabel: string;
  badgeClassName: string;
  headerClassName?: string;
  navItems: Array<NavItem & { active: boolean }>;
  footer?: React.ReactNode;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <div
        className={cn(
          "flex h-14 shrink-0 items-center justify-between border-b border-border px-4 md:hidden",
          headerClassName,
        )}
      >
        <div className="flex items-center">
          {brand}
          <span className={cn("ml-2 rounded-full px-2 py-0.5 text-xs font-medium", badgeClassName)}>
            {badgeLabel}
          </span>
        </div>
        <button
          type="button"
          aria-label="Open menu"
          onClick={() => setOpen(true)}
          className="flex size-9 items-center justify-center rounded-md hover:bg-black/5"
        >
          <Menu className="size-5" />
        </button>
      </div>

      {/* Backdrop */}
      <div
        aria-hidden
        onClick={() => setOpen(false)}
        className={cn(
          "fixed inset-0 z-50 bg-black/50 transition-opacity duration-200 md:hidden",
          open ? "opacity-100" : "pointer-events-none opacity-0",
        )}
      />

      {/* Drawer */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Navigation"
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85vw] flex-col bg-card shadow-xl transition-transform duration-200 md:hidden",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className={cn("flex h-14 shrink-0 items-center justify-between border-b border-border px-4", headerClassName)}>
          <div className="flex items-center">
            {brand}
            <span className={cn("ml-2 rounded-full px-2 py-0.5 text-xs font-medium", badgeClassName)}>
              {badgeLabel}
            </span>
          </div>
          <button
            type="button"
            aria-label="Close menu"
            onClick={() => setOpen(false)}
            className="flex size-9 items-center justify-center rounded-md hover:bg-black/5"
          >
            <X className="size-5" />
          </button>
        </div>
        <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-3">
          <NavLinks items={navItems} onNavigate={() => setOpen(false)} />
        </nav>
        {footer ? <div className="border-t border-border p-4">{footer}</div> : null}
      </div>
    </>
  );
}

export function CustomerShell({
  user,
  signOutAction,
  children,
}: {
  user: { name: string } | null;
  signOutAction: () => Promise<void>;
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  const nav: NavItem[] = [
    { label: "Home", href: "/", icon: Home },
    { label: "Find Vendors", href: "/search", icon: Search },
    { label: "My Bookings", href: "/orders", icon: FileText },
    { label: "Profile", href: "/account", icon: User },
  ];
  const navWithActive = nav.map((item) => ({
    ...item,
    active: item.href === "/" ? pathname === "/" : pathname.startsWith(item.href),
  }));

  const brand = (
    <Link href="/" className="font-serif text-xl font-semibold tracking-tight text-primary">
      Nexa
    </Link>
  );

  const footer = user ? (
    <>
      <div className="flex items-center gap-3 px-3 py-2 text-sm text-foreground">
        <div className="flex size-8 items-center justify-center rounded-full bg-primary/10 font-bold text-primary">
          {user.name.charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{user.name}</p>
        </div>
      </div>
      <form action={signOutAction}>
        <Button type="submit" variant="ghost" className="mt-2 w-full justify-start text-muted-foreground hover:text-foreground">
          <LogOut className="mr-2 size-4" />
          Log out
        </Button>
      </form>
    </>
  ) : null;

  return (
    <div className="flex min-h-screen flex-col bg-muted/30 md:flex-row">
      <MobileNav
        brand={brand}
        badgeLabel="Customer"
        badgeClassName="bg-secondary text-secondary-foreground"
        navItems={navWithActive}
        footer={footer}
      />

      <aside className="hidden w-64 shrink-0 flex-col border-r border-border bg-card md:flex">
        <div className="flex h-16 items-center border-b border-border px-6">
          {brand}
          <span className="ml-2 rounded-full bg-secondary px-2 py-0.5 text-xs font-medium text-secondary-foreground">
            Customer
          </span>
        </div>
        <nav className="flex flex-1 flex-col gap-1 overflow-y-auto px-3 py-4">
          <NavLinks items={navWithActive} />
        </nav>
        {footer ? <div className="border-t border-border p-4">{footer}</div> : null}
      </aside>

      <main className="flex-1 overflow-y-auto p-4 md:p-8">
        <div className="mx-auto max-w-6xl">{children}</div>
      </main>
    </div>
  );
}

export function VendorShell({
  businessName,
  onProbation,
  identityPending,
  identityCopy,
  signOutAction,
  children,
}: {
  businessName: string;
  onProbation: boolean;
  identityPending: boolean;
  identityCopy?: string;
  signOutAction: () => Promise<void>;
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  const nav: NavItem[] = [
    { label: "Dashboard", href: "/", icon: Activity },
    { label: "Bookings", href: "/orders", icon: FileText },
    { label: "Services", href: "/listings", icon: Briefcase },
    { label: "Earnings", href: "/wallet", icon: DollarSign },
    { label: "Reviews", href: "/reviews", icon: Star },
    { label: "Settings", href: "/profile", icon: Settings },
  ];
  const navWithActive = nav.map((item) => ({
    ...item,
    active: item.href === "/" ? pathname === "/studio" || pathname === "/" : pathname.startsWith(item.href),
  }));

  const brand = (
    <Link href="/" className="font-serif text-xl font-semibold tracking-tight text-primary">
      Nexa
    </Link>
  );

  const footer = (
    <>
      <div className="flex items-center gap-3 px-3 py-2 text-sm text-foreground">
        <div className="flex size-8 items-center justify-center rounded-full bg-primary/10 font-bold text-primary">
          {businessName.charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{businessName}</p>
          {onProbation ? <p className="text-xs text-accent">New provider</p> : null}
        </div>
      </div>
      <form action={signOutAction}>
        <Button type="submit" variant="ghost" className="mt-2 w-full justify-start text-muted-foreground hover:text-foreground">
          <LogOut className="mr-2 size-4" />
          Log out
        </Button>
      </form>
    </>
  );

  return (
    <div className="flex min-h-screen flex-col bg-muted/30 md:flex-row">
      <MobileNav
        brand={brand}
        badgeLabel="Vendor"
        badgeClassName="bg-accent text-accent-foreground"
        navItems={navWithActive}
        footer={footer}
      />

      <aside className="hidden w-64 shrink-0 flex-col border-r border-border bg-card md:flex">
        <div className="flex h-16 items-center border-b border-border px-6">
          {brand}
          <span className="ml-2 rounded-full bg-accent px-2 py-0.5 text-xs font-medium text-accent-foreground">
            Vendor
          </span>
        </div>
        <nav className="flex flex-1 flex-col gap-1 overflow-y-auto px-3 py-4">
          <NavLinks items={navWithActive} />
        </nav>
        <div className="border-t border-border p-4">{footer}</div>
      </aside>

      <main className="flex-1 overflow-y-auto p-4 md:p-8">
        <div className="mx-auto max-w-6xl">
          {identityPending ? (
            <div className="mb-6 flex items-center gap-3 rounded-lg bg-secondary p-4 text-secondary-foreground">
              <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                !
              </div>
              <div>
                <h4 className="font-semibold">Nexa needs to know who you are</h4>
                <p className="text-sm">
                  {identityCopy ??
                    "Send identification (CAC, NIN, BVN, passport, or driver's licence) — until Nexa has it, you won't be visible to customers."}
                </p>
              </div>
            </div>
          ) : null}
          {children}
        </div>
      </main>
    </div>
  );
}

export function AdminShell({
  roleLabel,
  navItems,
  signOutAction,
  children,
}: {
  roleLabel: string;
  navItems: NavItem[];
  signOutAction: () => Promise<void>;
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  const navWithActive = navItems.map((item) => ({
    ...item,
    active: item.href === "/" ? pathname === "/admin" || pathname === "/" : pathname.startsWith(item.href),
  }));

  const brand = (
    <Link href="/" className="font-serif text-xl font-semibold tracking-tight">
      Nexa
    </Link>
  );

  const footer = (
    <form action={signOutAction}>
      <Button type="submit" variant="ghost" className="w-full justify-start text-muted-foreground hover:text-foreground">
        <LogOut className="mr-2 size-4" />
        Log out Admin
      </Button>
    </form>
  );

  const headerClassName = "bg-sidebar-primary text-sidebar-primary-foreground";

  return (
    <div className="admin-shell flex min-h-screen flex-col bg-muted/30 md:flex-row">
      <MobileNav
        brand={brand}
        badgeLabel={roleLabel}
        badgeClassName="bg-black/20 text-white"
        headerClassName={headerClassName}
        navItems={navWithActive}
        footer={footer}
      />

      <aside className="hidden w-64 shrink-0 flex-col border-r border-border bg-card md:flex">
        <div className={cn("flex h-16 items-center border-b border-border px-6", headerClassName)}>
          {brand}
          <span className="ml-2 rounded-full bg-black/20 px-2 py-0.5 text-xs font-medium text-white">
            {roleLabel}
          </span>
        </div>
        <nav className="flex flex-1 flex-col gap-1 overflow-y-auto px-3 py-4">
          <NavLinks items={navWithActive} />
        </nav>
        <div className="border-t border-border p-4">{footer}</div>
      </aside>

      <main className="flex-1 overflow-y-auto p-4 md:p-8">
        <div className="mx-auto max-w-6xl">{children}</div>
      </main>
    </div>
  );
}

const ADMIN_ICON_MAP: Record<string, NavItem["icon"]> = {
  Dashboard: Activity,
  Vendors: Users,
  Listings: Tags,
  Bookings: FileText,
  Money: DollarSign,
  Subscriptions: Repeat,
  Support: CreditCard,
  Categories: FolderTree,
  Settings,
};

export function adminIcon(label: string): NavItem["icon"] {
  return ADMIN_ICON_MAP[label] ?? Activity;
}

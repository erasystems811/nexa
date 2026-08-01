"use client";

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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Ported from the Event-Escrow-Nexus reference (src/components/shells.tsx):
 * same structure, same classes, same fixed-sidebar/horizontal-mobile-strip
 * behavior. The only real change is data — the reference's useAuth()/wouter
 * are replaced with props from Nexa's actual session (server layout fetches
 * the real user/session and passes it down) and next/link + usePathname.
 */

type NavItem = { label: string; href: string; icon: React.ComponentType<{ className?: string }> };

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

  return (
    <div className="min-h-screen bg-muted/30 flex flex-col md:flex-row">
      <aside className="w-full md:w-64 bg-card border-b md:border-r border-border shrink-0 flex flex-col">
        <div className="h-16 flex items-center px-6 border-b border-border">
          <Link href="/" className="font-serif text-xl font-semibold tracking-tight text-primary">
            Nexa
          </Link>
          <span className="ml-2 text-xs font-medium bg-secondary text-secondary-foreground px-2 py-0.5 rounded-full">
            Customer
          </span>
        </div>
        <nav className="flex-1 overflow-y-auto py-4 px-3 flex gap-1 md:flex-col overflow-x-auto md:overflow-x-visible">
          {nav.map((item) => {
            const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href as Route}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors shrink-0",
                  active
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary/50",
                )}
              >
                <item.icon className="w-4 h-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        {user ? (
          <div className="p-4 border-t border-border hidden md:block">
            <div className="flex items-center gap-3 px-3 py-2 text-sm text-foreground">
              <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold">
                {user.name.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="truncate font-medium">{user.name}</p>
              </div>
            </div>
            <form action={signOutAction}>
              <Button
                type="submit"
                variant="ghost"
                className="w-full justify-start mt-2 text-muted-foreground hover:text-foreground"
              >
                <LogOut className="w-4 h-4 mr-2" />
                Log out
              </Button>
            </form>
          </div>
        ) : null}
      </aside>
      <main className="flex-1 p-4 md:p-8 overflow-y-auto">
        <div className="max-w-6xl mx-auto">{children}</div>
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

  return (
    <div className="min-h-screen bg-muted/30 flex flex-col md:flex-row">
      <aside className="w-full md:w-64 bg-card border-b md:border-r border-border shrink-0 flex flex-col">
        <div className="h-16 flex items-center px-6 border-b border-border">
          <Link href="/" className="font-serif text-xl font-semibold tracking-tight text-primary">
            Nexa
          </Link>
          <span className="ml-2 text-xs font-medium bg-accent text-accent-foreground px-2 py-0.5 rounded-full">
            Vendor
          </span>
        </div>
        <nav className="flex-1 overflow-y-auto py-4 px-3 flex gap-1 md:flex-col overflow-x-auto md:overflow-x-visible">
          {nav.map((item) => {
            const active = item.href === "/" ? pathname === "/studio" || pathname === "/" : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href as Route}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors shrink-0",
                  active
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary/50",
                )}
              >
                <item.icon className="w-4 h-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="p-4 border-t border-border hidden md:block">
          <div className="flex items-center gap-3 px-3 py-2 text-sm text-foreground">
            <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold">
              {businessName.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="truncate font-medium">{businessName}</p>
              {onProbation ? <p className="text-xs text-accent">New provider</p> : null}
            </div>
          </div>
          <form action={signOutAction}>
            <Button
              type="submit"
              variant="ghost"
              className="w-full justify-start mt-2 text-muted-foreground hover:text-foreground"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Log out
            </Button>
          </form>
        </div>
      </aside>
      <main className="flex-1 p-4 md:p-8 overflow-y-auto">
        <div className="max-w-6xl mx-auto">
          {identityPending ? (
            <div className="mb-6 bg-secondary text-secondary-foreground p-4 rounded-lg flex items-center gap-3">
              <div className="bg-primary text-primary-foreground w-8 h-8 rounded-full flex items-center justify-center shrink-0">
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

  return (
    <div className="admin-shell min-h-screen bg-muted/30 flex flex-col md:flex-row">
      <aside className="w-full md:w-64 bg-card border-b md:border-r border-border shrink-0 flex flex-col">
        <div className="h-16 flex items-center px-6 border-b border-border bg-sidebar-primary text-sidebar-primary-foreground">
          <Link href="/" className="font-serif text-xl font-semibold tracking-tight">
            Nexa
          </Link>
          <span className="ml-2 text-xs font-medium bg-black/20 text-white px-2 py-0.5 rounded-full">{roleLabel}</span>
        </div>
        <nav className="flex-1 overflow-y-auto py-4 px-3 flex gap-1 md:flex-col overflow-x-auto md:overflow-x-visible">
          {navItems.map((item) => {
            const active =
              item.href === "/" ? pathname === "/admin" || pathname === "/" : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href as Route}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors shrink-0",
                  active
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary/50",
                )}
              >
                <item.icon className="w-4 h-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="p-4 border-t border-border hidden md:block">
          <form action={signOutAction}>
            <Button
              type="submit"
              variant="ghost"
              className="w-full justify-start mt-2 text-muted-foreground hover:text-foreground"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Log out Admin
            </Button>
          </form>
        </div>
      </aside>
      <main className="flex-1 p-4 md:p-8 overflow-y-auto">
        <div className="max-w-6xl mx-auto">{children}</div>
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

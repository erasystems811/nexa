import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  LogOut,
  Menu,
  X,
  Activity,
  Users,
  Tags,
  FileText,
  DollarSign,
  Repeat,
  CreditCard,
  FolderTree,
  Settings,
} from "lucide-react";
import { Button } from "@nexa/design-system/src/components/ui/button";
import { cn } from "@nexa/design-system/src/lib/utils";

type NavItem = { label: string; href: string; icon: React.ComponentType<{ className?: string }> };

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

function NavLinks({ items, onNavigate }: { items: Array<NavItem & { active: boolean }>; onNavigate?: () => void }) {
  return (
    <>
      {items.map((item) => (
        <Link
          key={item.href}
          to={item.href}
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

export function AdminShell({
  roleLabel,
  navItems,
  onSignOut,
  children,
}: {
  roleLabel: string;
  navItems: Array<{ href: string; label: string }>;
  onSignOut: () => void;
  children: React.ReactNode;
}) {
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);

  useEffect(() => setOpen(false), [pathname]);

  const navWithActive = navItems.map((item) => ({
    ...item,
    icon: adminIcon(item.label),
    active: item.href === "/" ? pathname === "/" : pathname.startsWith(item.href),
  }));

  const brand = (
    <Link to="/" className="font-serif text-xl font-semibold tracking-tight">
      Nexa
    </Link>
  );

  const footer = (
    <Button type="button" variant="ghost" className="w-full justify-start text-muted-foreground hover:text-foreground" onClick={onSignOut}>
      <LogOut className="mr-2 size-4" />
      Log out Admin
    </Button>
  );

  const headerClassName = "bg-sidebar-primary text-sidebar-primary-foreground";

  return (
    <div className="admin-shell flex min-h-screen flex-col bg-muted/30 md:flex-row">
      <div className={cn("sticky top-0 z-40 flex h-14 shrink-0 items-center justify-between border-b border-border px-4 md:hidden", headerClassName)}>
        <div className="flex items-center">
          {brand}
          <span className="ml-2 rounded-full bg-black/20 px-2 py-0.5 text-xs font-medium text-white">{roleLabel}</span>
        </div>
        <button type="button" aria-label="Open menu" onClick={() => setOpen(true)} className="flex size-9 items-center justify-center rounded-md hover:bg-black/5">
          <Menu className="size-5" />
        </button>
      </div>

      <div
        aria-hidden
        onClick={() => setOpen(false)}
        className={cn("fixed inset-0 z-50 bg-black/50 transition-opacity duration-200 md:hidden", open ? "opacity-100" : "pointer-events-none opacity-0")}
      />
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
          {brand}
          <button type="button" aria-label="Close menu" onClick={() => setOpen(false)} className="flex size-9 items-center justify-center rounded-md hover:bg-black/5">
            <X className="size-5" />
          </button>
        </div>
        <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-3">
          <NavLinks items={navWithActive} onNavigate={() => setOpen(false)} />
        </nav>
        <div className="border-t border-border p-4">{footer}</div>
      </div>

      <aside className="hidden w-64 shrink-0 flex-col border-r border-border bg-card md:flex">
        <div className={cn("flex h-16 items-center border-b border-border px-6", headerClassName)}>
          {brand}
          <span className="ml-2 rounded-full bg-black/20 px-2 py-0.5 text-xs font-medium text-white">{roleLabel}</span>
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

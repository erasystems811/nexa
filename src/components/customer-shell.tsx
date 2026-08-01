"use client";

import { usePathname } from "next/navigation";
import type { Surface } from "@/lib/surfaces";
import { CustomerShell as PortedCustomerShell } from "@/components/shells";

// Paths that are their own app or a focused, chrome-free flow — no shell.
const HIDE = ["/login", "/register", "/reset", "/verify", "/apply", "/studio", "/admin", "/whatsapp", "/book"];

export function CustomerShell({
  surface,
  user,
  signOutAction,
  children,
}: {
  surface: Surface | null;
  user: { name: string } | null;
  signOutAction: () => Promise<void>;
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  // Studio / Admin subdomains are not the customer app — pass their own nested
  // layout's chrome through untouched. (Single-host mode: surface is null and
  // the path-based HIDE list below does the same job.)
  const isOtherSurface = surface !== "customer" && surface !== null;
  const isFocusedFlow = HIDE.some((p) => pathname === p || pathname.startsWith(`${p}/`));

  if (isOtherSurface || isFocusedFlow) return <>{children}</>;

  return (
    <PortedCustomerShell user={user} signOutAction={signOutAction}>
      {children}
    </PortedCustomerShell>
  );
}

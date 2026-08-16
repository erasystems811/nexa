import Link from "next/link";
import type { Route } from "next";
import { ArrowLeft } from "lucide-react";

/**
 * An explicit way back — the header's own logo already links home (the same
 * as HostelSure's), but a static logo doesn't read as a back control to most
 * people. This makes it unambiguous on pages that are one step off the
 * marketplace: search, profile, and the header-less apply/login flows.
 */
export function BackLink({ href = "/", label = "Back to Nexa" }: { href?: Route; label?: string }) {
  return (
    <Link
      href={href}
      className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition hover:text-foreground"
    >
      <ArrowLeft className="size-4" />
      {label}
    </Link>
  );
}

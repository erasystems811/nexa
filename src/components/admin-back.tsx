"use client";

import type { Route } from "next";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import clsx from "clsx";

/**
 * The Admin Console's back button, for the drill-down pages — a vendor, an
 * order, a customer, a staff member, a listing. The top nav bar jumps to a
 * section; this returns to the exact page you came from, which for an admin
 * reviewing a queue is usually the list with its filter still applied.
 *
 * `inAppNavigations` counts client-side moves in this document, resetting on a
 * hard load, so a deep link opened cold falls back to the section list instead
 * of having nowhere to go.
 */
let inAppNavigations = 0;

export function AdminBack({
  fallback,
  label = "Back",
  className,
}: {
  fallback: Route;
  label?: string;
  className?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const counted = useRef<string | null>(null);
  const [canGoBack, setCanGoBack] = useState(false);

  useEffect(() => {
    if (counted.current === pathname) return;
    counted.current = pathname;
    setCanGoBack(inAppNavigations > 0);
    inAppNavigations += 1;
  }, [pathname]);

  return (
    <button
      type="button"
      onClick={() => (canGoBack ? router.back() : router.push(fallback))}
      className={clsx(
        "mb-4 inline-flex h-9 items-center rounded-lg border border-[color:var(--color-line)] bg-white px-3 text-xs font-medium transition hover:bg-[color:var(--color-surface-sunk)]",
        className,
      )}
    >
      <span aria-hidden="true" className="mr-1.5">&larr;</span>
      {label}
    </button>
  );
}

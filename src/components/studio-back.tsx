"use client";

import type { Route } from "next";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import clsx from "clsx";

/**
 * Business Studio's back button, for the drill-down pages a vendor can wander
 * into — a listing, its availability calendar, the new-listing form, the
 * verification page. Studio's bottom tab bar already covers Home and the main
 * sections, so this is only a way back to the page you came from, and nothing
 * more. No "Home" to the customer site: this is the vendor's surface, and it
 * stays on it.
 *
 * `inAppNavigations` counts client-side moves in this document, resetting on a
 * hard load. A vendor who opened a deep link cold has no history to go back to,
 * so Back sends them to the page's parent instead of off the edge of the app.
 */
let inAppNavigations = 0;

export function StudioBack({
  fallback,
  label = "Back",
  className,
}: {
  /** Where Back goes when the page was opened directly, with no history. */
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
        "inline-flex h-9 items-center rounded-full border border-[color:var(--color-line)] bg-white px-3.5 text-xs font-medium transition hover:bg-[color:var(--color-surface-sunk)]",
        className,
      )}
    >
      <span aria-hidden="true" className="mr-1.5">&larr;</span>
      {label}
    </button>
  );
}

"use client";

import Link from "next/link";
import type { Route } from "next";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import clsx from "clsx";

/**
 * Client-side navigations made in this document. It resets on a hard load, which
 * is the signal we want: a customer who opened a shared listing link has no
 * in-app history, so Back must go to the page's parent rather than throw them
 * off the site entirely.
 */
let inAppNavigations = 0;

export function BackBar({
  fallback = "/",
  variant = "inline",
  className,
}: {
  /** Where Back goes when this page was opened directly, with nothing to return to. */
  fallback?: Route;
  /** `overlay` floats the buttons over a cover image; the parent must be relative. */
  variant?: "inline" | "overlay";
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

  const pill = clsx(
    "inline-flex h-9 items-center rounded-full px-3.5 text-xs font-medium transition",
    variant === "overlay"
      ? "bg-white/90 shadow-sm backdrop-blur hover:bg-white"
      : "border border-[color:var(--color-line)] bg-white hover:bg-[color:var(--color-surface-sunk)]",
  );

  return (
    <nav
      aria-label="Page navigation"
      className={clsx(
        "flex items-center gap-2",
        variant === "overlay" && "absolute left-4 top-4 z-10",
        className,
      )}
    >
      <button
        type="button"
        onClick={() => (canGoBack ? router.back() : router.push(fallback))}
        className={pill}
      >
        <span aria-hidden="true" className="mr-1.5">&larr;</span>
        Back
      </button>
      <Link href="/" className={pill}>
        Home
      </Link>
    </nav>
  );
}

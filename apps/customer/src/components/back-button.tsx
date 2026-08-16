"use client";

import { useRouter } from "next/navigation";
import type { Route } from "next";
import { ArrowLeft } from "lucide-react";

/**
 * For a page reached by tapping into something (a vendor, a listing, an
 * order) — real browser back, so it returns to the search results or
 * homepage the customer actually came from, not always home regardless of
 * where they started. Falls back to `fallbackHref` when there's no in-app
 * history to go back to (a shared link opened directly, a new tab).
 */
export function BackButton({ fallbackHref = "/", label = "Back" }: { fallbackHref?: Route; label?: string }) {
  const router = useRouter();

  return (
    <button
      type="button"
      onClick={() => {
        if (window.history.length > 1) router.back();
        else router.push(fallbackHref);
      }}
      className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition hover:text-foreground"
    >
      <ArrowLeft className="size-4" />
      {label}
    </button>
  );
}

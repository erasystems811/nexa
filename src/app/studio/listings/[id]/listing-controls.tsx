"use client";

import { useTransition } from "react";
import {
  deleteListingAction,
  duplicateListingAction,
  pauseListingAction,
} from "@/modules/provider/actions";
import type { ListingStatus } from "@/lib/db/types";

/** Pause, duplicate, delete. */
export function ListingControls({
  listingId,
  status,
}: {
  listingId: string;
  status: ListingStatus;
}) {
  const [pending, start] = useTransition();

  return (
    <div className="flex flex-wrap gap-2">
      {status === "approved" || status === "paused" ? (
        <button
          type="button"
          disabled={pending}
          onClick={() => start(() => pauseListingAction(listingId, status !== "paused"))}
          className="h-9 rounded-full border border-[color:var(--color-line)] px-4 text-xs font-medium disabled:opacity-40"
        >
          {status === "paused" ? "Unpause" : "Pause"}
        </button>
      ) : null}

      <button
        type="button"
        disabled={pending}
        onClick={() => start(() => duplicateListingAction(listingId))}
        className="h-9 rounded-full border border-[color:var(--color-line)] px-4 text-xs font-medium disabled:opacity-40"
      >
        Duplicate
      </button>

      <button
        type="button"
        disabled={pending}
        onClick={() => {
          if (confirm("Delete this listing? This cannot be undone.")) {
            start(() => deleteListingAction(listingId));
          }
        }}
        className="h-9 rounded-full border border-[color:var(--color-line)] px-4 text-xs font-medium text-[color:var(--color-danger)] disabled:opacity-40"
      >
        Delete
      </button>
    </div>
  );
}

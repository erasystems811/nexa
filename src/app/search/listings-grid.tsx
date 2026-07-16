"use client";

import { useState, useTransition } from "react";
import { ListingCard } from "@/components/listing-card";
import { loadMoreListingsAction } from "./actions";
import type { ListingFilters, ListingResult } from "@/modules/search";

const PAGE_SIZE = 40;

/**
 * Grows the results grid in place — no full-page reload, no pagination links.
 * This is what "no delay, no wait" actually means for a list that could be
 * thousands of rows deep: fetch a page at a time, append, and never load more
 * than the customer has actually scrolled to.
 */
export function ListingsGrid({
  initial,
  filters,
}: {
  initial: ListingResult[];
  filters: ListingFilters;
}) {
  const [items, setItems] = useState(initial);
  const [done, setDone] = useState(initial.length < PAGE_SIZE);
  const [pending, start] = useTransition();

  const loadMore = () => {
    start(async () => {
      const more = await loadMoreListingsAction(filters, items.length);
      setItems((prev) => [...prev, ...more]);
      if (more.length < PAGE_SIZE) setDone(true);
    });
  };

  return (
    <>
      <ul className="mt-6 grid grid-cols-2 gap-4">
        {items.map((r) => (
          <li key={r.id}>
            <ListingCard listing={r} />
          </li>
        ))}
      </ul>

      {!done ? (
        <button
          type="button"
          onClick={loadMore}
          disabled={pending}
          className="mx-auto mt-6 block h-11 rounded-full border border-[color:var(--color-line)] px-6 text-sm font-medium disabled:opacity-40"
        >
          {pending ? "Loading…" : "Show more"}
        </button>
      ) : null}
    </>
  );
}

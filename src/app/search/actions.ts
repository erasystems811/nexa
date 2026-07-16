"use server";

import { searchListings, type ListingFilters, type ListingResult } from "@/modules/search";

/** "Load more" on the search results grid — the next page, same filters. */
export async function loadMoreListingsAction(
  filters: ListingFilters,
  offset: number,
): Promise<ListingResult[]> {
  return searchListings({ ...filters, offset });
}

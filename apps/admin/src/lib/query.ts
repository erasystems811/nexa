import { QueryClient, keepPreviousData, useQuery, type UseQueryOptions } from "@tanstack/react-query";
import { apiGet } from "./api";

// staleTime > 0 means a page you've already visited renders instantly from
// cache on revisit instead of blanking to "Loading…" and refetching — the
// data quietly refreshes in the background only once it's actually stale.
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      retry: 1,
      // Safe to leave on: with placeholderData/keepPreviousData below, a
      // focus-triggered refetch swaps fresh data in silently once it
      // resolves — it never blanks the page the way the old auth-gated
      // full-page loader did.
    },
  },
});

type Params = Record<string, string | number | boolean | undefined>;

/**
 * Thin wrapper around apiGet for read paths: same signature apiGet callers
 * already know, but cached and kept-on-screen across navigations instead of
 * refetched-and-blanked every time.
 */
export function useApiQuery<T>(
  key: readonly unknown[],
  path: string,
  params?: Params,
  options?: Partial<UseQueryOptions<T>>,
) {
  return useQuery<T>({
    queryKey: key,
    queryFn: () => apiGet<T>(path, params),
    placeholderData: keepPreviousData,
    ...options,
  });
}

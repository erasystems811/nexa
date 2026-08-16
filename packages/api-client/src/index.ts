/**
 * Talks to api-server over HTTP. Every function here has the same name,
 * parameter shape, and return shape as the old src/modules/search and
 * src/modules/marketplace functions — the only thing that changed is that a
 * Supabase client is no longer threaded through; api-server does that now,
 * scoped to whatever access token (if any) this client is configured with.
 */

const BASE_URL =
  process.env.API_BASE_URL ?? process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";

/** Set per-request (e.g. from a Server Component that knows the caller's session) when a call needs to run as a signed-in user. */
let accessToken: string | undefined;
export function setAccessToken(token: string | undefined) {
  accessToken = token;
}

async function apiFetch<T>(path: string, params?: Record<string, string | number | undefined>): Promise<T> {
  const url = new URL(path, BASE_URL);
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined) url.searchParams.set(key, String(value));
    }
  }

  const res = await fetch(url, {
    headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`api-server ${path} responded ${res.status}`);
  }
  return res.json() as Promise<T>;
}

// ---- marketplace ------------------------------------------------------------

export interface Category {
  id: string;
  name: string;
  slug: string;
  icon: string | null;
  fulfillment_type: string;
}

export interface City {
  id: string;
  name: string;
  slug: string;
}

export function listCategories(): Promise<Category[]> {
  return apiFetch("/marketplace/categories");
}

export function listCities(): Promise<City[]> {
  return apiFetch("/marketplace/cities");
}

export function categoryImages(): Promise<Record<string, string>> {
  return apiFetch("/marketplace/category-images");
}

export function getProviderBySlug(slug: string) {
  return apiFetch(`/marketplace/providers/${encodeURIComponent(slug)}`);
}

export function getListingBySlug(slug: string) {
  return apiFetch(`/marketplace/listings/${encodeURIComponent(slug)}`);
}

// ---- search -------------------------------------------------------------

export interface ListingFilters {
  q?: string;
  categorySlug?: string;
  location?: string;
  minPriceKobo?: number;
  maxPriceKobo?: number;
  minRating?: number;
  availableAt?: string;
  limit?: number;
  offset?: number;
}

export interface ListingResult {
  id: string;
  slug: string;
  title: string;
  priceKobo: number | null;
  priceMinKobo: number | null;
  priceMaxKobo: number | null;
  priceType: "fixed" | "negotiable";
  categoryName: string;
  categorySlug: string;
  providerName: string;
  providerSlug: string;
  coverUrl: string | null;
  avgRating: number | null;
  reviewCount: number;
}

export interface VendorResult {
  id: string;
  slug: string;
  businessName: string;
  logoUrl: string | null;
  coverUrl: string | null;
  cityName: string | null;
  avgRating: number | null;
  reviewCount: number;
  serviceCount: number;
}

export function searchVendors(filters: { categorySlug?: string; location?: string; limit?: number }): Promise<VendorResult[]> {
  return apiFetch("/search/vendors", {
    category: filters.categorySlug,
    location: filters.location,
    limit: filters.limit,
  });
}

export function searchListings(filters: ListingFilters): Promise<ListingResult[]> {
  return apiFetch("/search/listings", {
    q: filters.q,
    category: filters.categorySlug,
    location: filters.location,
    min: filters.minPriceKobo !== undefined ? filters.minPriceKobo / 100 : undefined,
    max: filters.maxPriceKobo !== undefined ? filters.maxPriceKobo / 100 : undefined,
    rating: filters.minRating,
    at: filters.availableAt,
    limit: filters.limit,
    offset: filters.offset,
  });
}

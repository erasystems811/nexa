import type { FastifyPluginAsync } from "fastify";
import { searchVendors, searchListings, type ListingFilters } from "../modules/search/index.js";

interface SearchQuery {
  q?: string;
  category?: string;
  location?: string;
  min?: string;
  max?: string;
  rating?: string;
  at?: string;
  limit?: string;
  offset?: string;
}

const searchRoutes: FastifyPluginAsync = async (app) => {
  app.get<{ Querystring: SearchQuery }>("/vendors", async (request) => {
    const { category, location, limit } = request.query;
    return searchVendors(request.supabase, {
      categorySlug: category,
      location,
      limit: limit ? Number(limit) : undefined,
    });
  });

  app.get<{ Querystring: SearchQuery }>("/listings", async (request) => {
    const q = request.query;
    const filters: ListingFilters = {
      q: q.q,
      categorySlug: q.category,
      location: q.location,
      minPriceKobo: q.min ? Number(q.min) * 100 : undefined,
      maxPriceKobo: q.max ? Number(q.max) * 100 : undefined,
      minRating: q.rating ? Number(q.rating) : undefined,
      availableAt: q.at,
      limit: q.limit ? Number(q.limit) : undefined,
      offset: q.offset ? Number(q.offset) : undefined,
    };
    return searchListings(request.supabase, filters);
  });
};

export default searchRoutes;

import type { FastifyPluginAsync } from "fastify";
import {
  listCategories,
  listCities,
  recentListings,
  featuredProviders,
  getProviderBySlug,
  getListingBySlug,
  categoryImages,
} from "../modules/marketplace/index.js";

const marketplaceRoutes: FastifyPluginAsync = async (app) => {
  app.get("/categories", async (request) => listCategories(request.supabase));
  app.get("/cities", async (request) => listCities(request.supabase));
  app.get("/category-images", async () => categoryImages());

  app.get<{ Querystring: { limit?: string } }>("/listings/recent", async (request) => {
    const limit = request.query.limit ? Number(request.query.limit) : undefined;
    return recentListings(request.supabase, limit);
  });

  app.get<{ Querystring: { limit?: string } }>("/providers/featured", async (request) => {
    const limit = request.query.limit ? Number(request.query.limit) : undefined;
    return featuredProviders(request.supabase, limit);
  });

  app.get<{ Params: { slug: string } }>("/providers/:slug", async (request, reply) => {
    const result = await getProviderBySlug(request.supabase, request.params.slug);
    if (!result) return reply.code(404).send({ error: "Provider not found" });
    return result;
  });

  app.get<{ Params: { slug: string } }>("/listings/:slug", async (request, reply) => {
    const result = await getListingBySlug(request.supabase, request.params.slug);
    if (!result) return reply.code(404).send({ error: "Listing not found" });
    return result;
  });
};

export default marketplaceRoutes;

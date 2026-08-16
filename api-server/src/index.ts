import Fastify from "fastify";
import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import { env, corsOrigins } from "./env.js";
import authPlugin from "./plugins/auth.js";
import marketplaceRoutes from "./routes/marketplace.js";
import searchRoutes from "./routes/search.js";
import settingsRoutes from "./routes/settings.js";
import providerRoutes from "./routes/provider.js";
import bookingsRoutes from "./routes/bookings.js";
import adminRoutes from "./routes/admin.js";

const app = Fastify({ logger: true });

// Every module's own error class (ProviderError, BookingsError,
// PaymentsError, AdminError...) is a validation/authorization failure, not a
// server bug — same distinction Next.js Server Actions made by returning
// { error: e.message } instead of throwing to a 500 page. Anything that
// already set its own statusCode (auth failures) keeps it.
const KNOWN_ERROR_NAMES = new Set([
  "ProviderError",
  "BookingsError",
  "PaymentsError",
  "AdminError",
  "MessagingError",
  "GatewayError",
]);
app.setErrorHandler((error: Error & { statusCode?: number }, _request, reply) => {
  const statusCode = error.statusCode ?? (KNOWN_ERROR_NAMES.has(error.name) ? 400 : 500);
  if (statusCode >= 500) app.log.error(error);
  reply.code(statusCode).send({ error: error.message });
});

await app.register(cors, { origin: corsOrigins, credentials: false });
await app.register(multipart, { limits: { fileSize: 10 * 1024 * 1024 } });
await app.register(authPlugin);

await app.register(marketplaceRoutes, { prefix: "/marketplace" });
await app.register(searchRoutes, { prefix: "/search" });
await app.register(settingsRoutes, { prefix: "/settings" });
await app.register(providerRoutes, { prefix: "/provider" });
await app.register(bookingsRoutes, { prefix: "/bookings" });
await app.register(adminRoutes, { prefix: "/admin" });

app.get("/health", async () => ({ ok: true }));

app.listen({ port: env.PORT, host: "0.0.0.0" }, (err, address) => {
  if (err) {
    app.log.error(err);
    process.exit(1);
  }
  app.log.info(`Nexa API server listening on ${address}`);
});

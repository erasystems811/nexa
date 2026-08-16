import type { FastifyPluginAsync, FastifyRequest } from "fastify";
import {
  checkout,
  resumePayment,
  listMyOrders,
  getMyOrder,
  cancelBookingByCustomer,
  type CheckoutInput,
} from "../modules/bookings/index.js";

function requireCustomer(request: FastifyRequest) {
  if (!request.user) {
    throw Object.assign(new Error("Sign in to do this"), { statusCode: 401 });
  }
  return { id: request.user.id, email: request.user.email ?? "", name: undefined as string | undefined };
}

const bookingsRoutes: FastifyPluginAsync = async (app) => {
  app.post<{ Body: CheckoutInput }>("/checkout", async (request) => {
    const customer = requireCustomer(request);
    return checkout(request.supabase, request.body, customer);
  });

  app.post<{ Params: { id: string } }>("/:id/resume-payment", async (request) => {
    const customer = requireCustomer(request);
    return resumePayment(request.supabase, request.params.id, customer);
  });

  app.get("/mine", async (request) => {
    requireCustomer(request);
    return listMyOrders(request.supabase);
  });

  app.get<{ Params: { id: string } }>("/:id", async (request, reply) => {
    requireCustomer(request);
    const order = await getMyOrder(request.supabase, request.params.id);
    if (!order) return reply.code(404).send({ error: "Booking not found" });
    return order;
  });

  app.post<{ Params: { id: string } }>("/:id/cancel", async (request) => {
    requireCustomer(request);
    await cancelBookingByCustomer(request.params.id);
    return { ok: true };
  });
};

export default bookingsRoutes;

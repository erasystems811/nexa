import type { FastifyPluginAsync, FastifyRequest } from "fastify";
import { toFile } from "../lib/multipart.js";
import * as admin from "../modules/admin/index.js";
import { PERMISSIONS as P } from "../modules/admin/permissions.js";
import type { Permission, StaffRole } from "../modules/admin/permissions.js";
import type { SubscriptionStatus } from "../modules/admin/subscriptions.js";
import type { BookingStatus, VendorTier } from "@nexa/db-types/src/types";

/** Every privileged route names the permission it needs and enforces it here — same authorisation boundary the old Server Actions were. */
function actor(request: FastifyRequest, permission: Permission) {
  return admin.requirePermission(request.supabase, permission);
}

const adminRoutes: FastifyPluginAsync = async (app) => {
  // ---- session ---------------------------------------------------------

  /**
   * The one unauthenticated door into the Admin Console. Not gated by
   * requirePermission — there is no session yet at this point. Its own
   * credential check (a fixed username/password pair from env, unrelated to
   * Supabase Auth) IS the gate. On a match it provisions/repairs the real
   * super-admin login and hands back the email the caller signs in with
   * directly against Supabase — this server never issues sessions itself.
   */
  app.post<{ Body: { username: string; password: string } }>("/bootstrap-super-admin", async (request) => {
    return admin.ensureEnvSuperAdmin(request.body.username, request.body.password);
  });

  app.get("/me", async (request) => {
    const staff = await admin.requireStaff(request.supabase);
    await admin.recordLogin(staff.userId);
    return staff;
  });

  // ---- dashboard ---------------------------------------------------------
  app.get("/dashboard", async (request) => {
    await admin.requireStaff(request.supabase);
    return admin.adminDashboard();
  });

  // ---- categories ---------------------------------------------------------
  app.get("/categories", async (request) => {
    await actor(request, P.settingsManage);
    return admin.listCategoriesForAdmin();
  });

  app.post<{ Params: { slug: string } }>("/categories/:slug/image", async (request) => {
    const actorId = await actor(request, P.settingsManage);
    const part = await request.file();
    if (!part) throw Object.assign(new Error("Choose a photo"), { statusCode: 400 });
    const file = await toFile(part);
    await admin.setCategoryImage(actorId, request.params.slug, file);
    return { ok: true };
  });

  app.delete<{ Params: { slug: string } }>("/categories/:slug/image", async (request) => {
    const actorId = await actor(request, P.settingsManage);
    await admin.removeCategoryImage(actorId, request.params.slug);
    return { ok: true };
  });

  /** Self-serve vs paid service vs paid performer — see VENDOR_TIERS. Only self_serve changes runtime behavior. */
  app.post<{ Params: { id: string }; Body: { tier: VendorTier } }>("/categories/:id/vendor-tier", async (request) => {
    const actorId = await actor(request, P.settingsManage);
    await admin.setCategoryVendorTier(actorId, request.params.id, request.body.tier);
    return { ok: true };
  });

  // ---- providers ---------------------------------------------------------
  app.get<{ Querystring: { status?: string } }>("/providers", async (request) => {
    await actor(request, P.providersView);
    return admin.listProviders(request.query.status);
  });

  app.get<{ Params: { id: string } }>("/providers/:id", async (request, reply) => {
    await actor(request, P.providersView);
    const detail = await admin.getProviderDetail(request.params.id);
    if (!detail) return reply.code(404).send({ error: "No such vendor" });
    return detail;
  });

  app.post<{ Body: { email: string; businessName: string; cityId?: string | null } }>("/providers", async (request) => {
    const actorId = await actor(request, P.providersApprove);
    return admin.addProviderManually(actorId, request.body);
  });

  app.post<{ Params: { id: string } }>("/providers/:id/approve", async (request) => {
    const actorId = await actor(request, P.providersApprove);
    return admin.approveProvider(actorId, request.params.id);
  });

  /** Approves the vendor, their ID documents, and every listing submitted with the application — one action, one review. */
  app.post<{ Params: { id: string } }>("/providers/:id/approve-with-listings", async (request) => {
    const actorId = await actor(request, P.providersApprove);
    return admin.approveProviderAndListings(actorId, request.params.id);
  });

  app.post<{ Params: { id: string }; Body: { reason?: string } }>("/providers/:id/reject", async (request) => {
    const actorId = await actor(request, P.providersApprove);
    await admin.rejectProvider(actorId, request.params.id, request.body?.reason ?? "");
    return { ok: true };
  });

  app.post<{ Params: { id: string }; Body: { suspended: boolean } }>("/providers/:id/suspend", async (request) => {
    const actorId = await actor(request, P.providersSuspend);
    await admin.setProviderSuspended(actorId, request.params.id, request.body.suspended);
    return { ok: true };
  });

  app.post<{ Params: { id: string }; Body: { featured: boolean } }>("/providers/:id/feature", async (request) => {
    const actorId = await actor(request, P.providersEdit);
    await admin.setProviderFeatured(actorId, request.params.id, request.body.featured);
    return { ok: true };
  });

  app.post<{ Params: { id: string }; Body: { reason?: string } }>("/providers/:id/remove", async (request) => {
    const actorId = await actor(request, P.providersRemove);
    await admin.removeProvider(actorId, request.params.id, request.body?.reason ?? "");
    return { ok: true };
  });

  /**
   * The vendor's ID, looked at by a human. Approving two of them is what lets a
   * vendor's services reach a customer, so it takes the same permission as
   * approving the vendor itself.
   */
  app.post<{ Params: { id: string; docId: string }; Body: { approved: boolean; notes?: string } }>(
    "/providers/:id/documents/:docId/decide",
    async (request) => {
      const actorId = await actor(request, P.providersApprove);
      await admin.decideDocument(actorId, request.params.docId, request.body.approved, request.body.notes);
      return { ok: true };
    },
  );

  // ---- strikes / appeals ---------------------------------------------------
  app.post<{ Params: { id: string } }>("/orders/:id/no-show", async (request) => {
    const actorId = await actor(request, P.providersSuspend);
    await admin.recordNoShow(actorId, request.params.id);
    return { ok: true };
  });

  app.get<{ Params: { id: string } }>("/providers/:id/strikes", async (request) => {
    await actor(request, P.providersView);
    return admin.listStrikes(request.params.id);
  });

  app.post<{ Params: { id: string }; Body: { upheld: boolean } }>("/strikes/:id/appeal", async (request) => {
    const actorId = await actor(request, P.providersSuspend);
    await admin.resolveAppeal(actorId, request.params.id, request.body.upheld);
    return { ok: true };
  });

  // ---- listings ---------------------------------------------------------
  app.get("/listings/queue", async (request) => {
    await actor(request, P.listingsView);
    return admin.listingQueue();
  });

  app.get<{ Querystring: { status?: string } }>("/listings", async (request) => {
    await actor(request, P.listingsView);
    return admin.listAllListings(request.query.status);
  });

  app.get<{ Params: { id: string } }>("/listings/:id", async (request, reply) => {
    await actor(request, P.listingsView);
    const listing = await admin.getListingForReview(request.params.id);
    if (!listing) return reply.code(404).send({ error: "No such listing" });
    return listing;
  });

  app.post<{
    Params: { id: string };
    Body: { decision: "approved" | "rejected" | "changes_requested" | "hidden"; reason?: string };
  }>("/listings/:id/decide", async (request) => {
    const actorId = await actor(request, P.listingsApprove);
    await admin.decideListing(actorId, request.params.id, request.body.decision, request.body.reason);
    return { ok: true };
  });

  app.post<{ Params: { id: string } }>("/listings/:id/restore", async (request) => {
    const actorId = await actor(request, P.listingsApprove);
    await admin.restoreListing(actorId, request.params.id);
    return { ok: true };
  });

  /**
   * Approve (or reject) one photo added to a listing that is already live —
   * approving the listing does not come round again, so a new photo would sit
   * "waiting" forever with nothing to release it.
   */
  app.post<{ Params: { id: string }; Body: { approved: boolean } }>("/media/:id/decide", async (request) => {
    const actorId = await actor(request, P.listingsApprove);
    await admin.decideMedia(actorId, request.params.id, request.body.approved);
    return { ok: true };
  });

  // ---- orders ---------------------------------------------------------
  app.get<{ Querystring: { status?: string } }>("/orders", async (request) => {
    await actor(request, P.ordersView);
    return admin.listOrders(request.query.status);
  });

  app.get<{ Params: { id: string } }>("/orders/:id", async (request, reply) => {
    await actor(request, P.ordersView);
    const detail = await admin.getOrderDetail(request.params.id);
    if (!detail) return reply.code(404).send({ error: "No such booking" });
    return detail;
  });

  app.post<{ Params: { id: string }; Body: { status: BookingStatus; reason: string } }>(
    "/orders/:id/override",
    async (request) => {
      const actorId = await actor(request, P.ordersOverride);
      await admin.overrideStatus(actorId, request.params.id, request.body.status, request.body.reason);
      return { ok: true };
    },
  );

  // ---- customers ---------------------------------------------------------
  app.get("/customers", async (request) => {
    await actor(request, P.customersView);
    return admin.listCustomers();
  });

  app.get<{ Params: { id: string } }>("/customers/:id", async (request, reply) => {
    await actor(request, P.customersView);
    const detail = await admin.getCustomerDetail(request.params.id);
    if (!detail) return reply.code(404).send({ error: "No such customer" });
    return detail;
  });

  // ---- money ---------------------------------------------------------
  app.get("/money/overview", async (request) => {
    await actor(request, P.paymentsView);
    return admin.moneyOverview();
  });

  app.get("/money/vendors-waiting", async (request) => {
    await actor(request, P.paymentsView);
    return admin.vendorsWaitingToBePaid();
  });

  app.get<{ Querystring: { limit?: string } }>("/money/recent", async (request) => {
    await actor(request, P.paymentsView);
    const limit = request.query.limit ? Number(request.query.limit) : undefined;
    return admin.recentMoneyMoves(limit);
  });

  /** Pay the vendor out of the money Nexa is holding on this booking. The admin picks the amount, in kobo; the module refuses anything above what is still held. */
  app.post<{ Params: { id: string }; Body: { amountKobo: number } }>("/orders/:id/pay-vendor", async (request) => {
    const actorId = await actor(request, P.paymentsPayout);
    await admin.releaseToVendor(actorId, request.params.id, request.body.amountKobo);
    return { ok: true };
  });

  app.post<{ Params: { id: string }; Body: { amountKobo: number; reason: string } }>(
    "/orders/:id/refund",
    async (request) => {
      const actorId = await actor(request, P.paymentsRefund);
      await admin.adminRefund(actorId, request.params.id, request.body.amountKobo, request.body.reason);
      return { ok: true };
    },
  );

  // ---- subscriptions (the monthly platform fee) ------------------------------
  app.get<{ Querystring: { status?: string } }>("/subscriptions", async (request) => {
    await actor(request, P.subscriptionsView);
    return admin.listSubscriptions(request.query.status);
  });

  app.get("/subscriptions/overview", async (request) => {
    await actor(request, P.subscriptionsView);
    return admin.subscriptionOverview();
  });

  app.get<{ Params: { id: string } }>("/providers/:id/subscription", async (request) => {
    await actor(request, P.subscriptionsView);
    return admin.getProviderSubscription(request.params.id);
  });

  /** Records a payment Admin has confirmed by hand — a transfer or cash, since Flutterwave cannot auto-bill yet. Omit amountKobo to charge the vendor's usual amount. */
  app.post<{ Params: { id: string }; Body: { amountKobo?: number } }>(
    "/providers/:id/subscription/mark-paid",
    async (request) => {
      const actorId = await actor(request, P.subscriptionsManage);
      await admin.markSubscriptionPaid(actorId, request.params.id, request.body?.amountKobo);
      return { ok: true };
    },
  );

  app.post<{ Params: { id: string }; Body: { status: SubscriptionStatus } }>(
    "/providers/:id/subscription/status",
    async (request) => {
      const actorId = await actor(request, P.subscriptionsManage);
      await admin.setSubscriptionStatus(actorId, request.params.id, request.body.status);
      return { ok: true };
    },
  );

  // ---- disputes ---------------------------------------------------------
  app.get<{ Querystring: { status?: string } }>("/disputes", async (request) => {
    await actor(request, P.disputesView);
    return admin.listDisputes(request.query.status);
  });

  app.get<{ Params: { id: string } }>("/disputes/:id", async (request, reply) => {
    await actor(request, P.disputesView);
    const detail = await admin.getDisputeDetail(request.params.id);
    if (!detail) return reply.code(404).send({ error: "No such dispute" });
    return detail;
  });

  app.post<{ Params: { id: string }; Body: { outcome: "resolved" | "rejected"; note: string } }>(
    "/disputes/:id/resolve",
    async (request) => {
      const actorId = await actor(request, P.disputesResolve);
      await admin.resolveDispute(actorId, request.params.id, request.body.outcome, request.body.note);
      return { ok: true };
    },
  );

  app.post<{ Params: { id: string }; Body: { note?: string } }>("/disputes/:id/pay-vendor", async (request) => {
    const actorId = await actor(request, P.disputesResolve);
    await admin.payVendorAndResolve(actorId, request.params.id, request.body?.note ?? "");
    return { ok: true };
  });

  app.post<{ Params: { id: string }; Body: { note?: string } }>("/disputes/:id/refund-customer", async (request) => {
    const actorId = await actor(request, P.disputesResolve);
    await admin.refundCustomerAndResolve(actorId, request.params.id, request.body?.note ?? "");
    return { ok: true };
  });

  // ---- support requests -------------------------------------------------------
  app.get<{ Querystring: { status?: "open" | "in_progress" | "resolved" } }>("/support", async (request) => {
    await actor(request, P.supportHandle);
    return admin.listSupportRequests(request.query.status);
  });

  app.post<{ Params: { id: string }; Body: { assigneeId: string } }>("/support/:id/assign", async (request) => {
    const actorId = await actor(request, P.supportHandle);
    await admin.assignSupportRequest(actorId, request.params.id, request.body.assigneeId);
    return { ok: true };
  });

  app.post<{ Params: { id: string } }>("/support/:id/resolve", async (request) => {
    const actorId = await actor(request, P.supportHandle);
    await admin.resolveSupportRequest(actorId, request.params.id);
    return { ok: true };
  });

  app.get("/support/notification-numbers", async (request) => {
    await actor(request, P.settingsManage);
    return admin.listNotificationNumbers();
  });

  app.post<{ Body: { phone: string; label?: string } }>("/support/notification-numbers", async (request) => {
    const actorId = await actor(request, P.settingsManage);
    if (!request.body.phone?.trim()) throw Object.assign(new Error("Enter a phone number"), { statusCode: 400 });
    await admin.addNotificationNumber(actorId, request.body.phone, request.body.label);
    return { ok: true };
  });

  app.delete<{ Params: { id: string } }>("/support/notification-numbers/:id", async (request) => {
    const actorId = await actor(request, P.settingsManage);
    await admin.removeNotificationNumber(actorId, request.params.id);
    return { ok: true };
  });

  // ---- moderation -----------------------------------------------------------
  app.get<{ Querystring: { status?: "pending" | "confirmed" | "dismissed" } }>("/moderation", async (request) => {
    await actor(request, P.moderationView);
    return admin.listFlags(request.query.status);
  });

  app.post<{ Params: { id: string }; Body: { decision: "confirmed" | "dismissed" } }>(
    "/moderation/:id/resolve",
    async (request) => {
      const actorId = await actor(request, P.moderationResolve);
      await admin.resolveFlag(actorId, request.params.id, request.body.decision);
      return { ok: true };
    },
  );

  app.post<{ Params: { id: string } }>("/moderation/:id/strike", async (request) => {
    const actorId = await actor(request, P.moderationStrike);
    await admin.convertFlagToStrike(actorId, request.params.id);
    return { ok: true };
  });

  // ---- staff (needs staff.manage) -------------------------------------------
  app.get("/staff", async (request) => {
    await actor(request, P.staffManage);
    return admin.listStaff();
  });

  app.get<{ Params: { id: string } }>("/staff/:id", async (request, reply) => {
    await actor(request, P.staffManage);
    const detail = await admin.getStaffMember(request.params.id);
    if (!detail) return reply.code(404).send({ error: "No such staff member" });
    return detail;
  });

  app.get<{ Params: { id: string } }>("/staff/:id/activity", async (request) => {
    await actor(request, P.staffManage);
    const staff = await admin.getStaffMember(request.params.id);
    if (!staff) throw Object.assign(new Error("No such staff member"), { statusCode: 404 });
    return admin.staffActivity(staff.user_id);
  });

  app.post<{ Body: { email: string; fullName: string; role: StaffRole; department?: string } }>(
    "/staff",
    async (request) => {
      const actorId = await actor(request, P.staffManage);
      return admin.inviteStaff(actorId, request.body);
    },
  );

  app.post<{ Params: { id: string }; Body: { role: StaffRole } }>("/staff/:id/role", async (request) => {
    const actorId = await actor(request, P.staffManage);
    await admin.setStaffRole(actorId, request.params.id, request.body.role);
    return { ok: true };
  });

  app.post<{ Params: { id: string }; Body: { permission: Permission; grant: boolean } }>(
    "/staff/:id/permission",
    async (request) => {
      const actorId = await actor(request, P.staffManage);
      await admin.toggleStaffPermission(actorId, request.params.id, request.body.permission, request.body.grant);
      return { ok: true };
    },
  );

  app.post<{ Params: { id: string }; Body: { status: "active" | "suspended" } }>("/staff/:id/status", async (request) => {
    const actorId = await actor(request, P.staffManage);
    await admin.setStaffStatus(actorId, request.params.id, request.body.status);
    return { ok: true };
  });

  // ---- activity feed ----------------------------------------------------
  app.get("/activity", async (request) => {
    await actor(request, P.staffManage);
    return admin.activityFeed();
  });
};

export default adminRoutes;

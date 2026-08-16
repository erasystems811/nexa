import type { FastifyPluginAsync, FastifyRequest } from "fastify";
import { toFile } from "../lib/multipart.js";
import { listBanks } from "../modules/payments/index.js";
import {
  requireProvider,
  providerDashboard,
  updateProfile,
  getContact,
  updateContact,
  uploadProfilePhoto,
  myIdentityStatus,
  submitIdDocument,
  listMyListings,
  getMyListing,
  createListing,
  updateListing,
  setListingPaused,
  deleteListing,
  duplicateListing,
  listMedia,
  uploadMedia,
  deleteMedia,
  listAvailability,
  blockUnavailable,
  removeBlock,
  listProviderOrders,
  accept,
  reject,
  startWork,
  enterCompletionCode,
  reportProblem,
  getWallet,
  updateBankDetails,
  listMyReviews,
  replyToReview,
  mySubscription,
  type ListingInput,
} from "../modules/provider/index.js";

/** Every route here needs a signed-in vendor — resolves their provider row from request.user's session, the same authority requireProvider always used. */
async function provider(request: FastifyRequest) {
  return requireProvider(request.supabase);
}

const providerRoutes: FastifyPluginAsync = async (app) => {
  app.get("/me", async (request) => provider(request));

  app.get("/dashboard", async (request) => {
    const p = await provider(request);
    return providerDashboard(request.supabase, p.id);
  });

  app.patch<{ Body: Parameters<typeof updateProfile>[2] }>("/profile", async (request) => {
    const p = await provider(request);
    await updateProfile(request.supabase, p.id, request.body);
    return { ok: true };
  });

  app.post("/profile/photo", async (request) => {
    const p = await provider(request);
    const part = await request.file();
    if (!part) throw Object.assign(new Error("No photo attached"), { statusCode: 400 });
    const kind = (part.fields.kind as { value?: string } | undefined)?.value === "cover" ? "cover" : "logo";
    const file = await toFile(part);
    const url = await uploadProfilePhoto(request.supabase, p.id, kind, file);
    return { url };
  });

  app.get("/contact", async (request) => {
    const p = await provider(request);
    return getContact(request.supabase, p.id);
  });

  app.patch<{ Body: { contact_phone?: string; contact_email?: string } }>("/contact", async (request) => {
    const p = await provider(request);
    await updateContact(request.supabase, p.id, request.body);
    return { ok: true };
  });

  app.get("/identity", async (request) => {
    const p = await provider(request);
    return myIdentityStatus(request.supabase, p.id);
  });

  app.post("/identity/documents", async (request) => {
    const p = await provider(request);
    const parts = request.parts();
    let idType = "";
    let idNumber = "";
    let file: File | null = null;
    for await (const part of parts) {
      if (part.type === "file") file = await toFile(part);
      else if (part.fieldname === "idType") idType = String(part.value);
      else if (part.fieldname === "idNumber") idNumber = String(part.value);
    }
    if (!file) throw Object.assign(new Error("No ID photo attached"), { statusCode: 400 });
    await submitIdDocument(request.supabase, p.id, { idType: idType as never, idNumber, file });
    return { ok: true };
  });

  app.get("/listings", async (request) => {
    const p = await provider(request);
    return listMyListings(request.supabase, p.id);
  });

  app.get<{ Params: { id: string } }>("/listings/:id", async (request, reply) => {
    const p = await provider(request);
    const listing = await getMyListing(request.supabase, p.id, request.params.id);
    if (!listing) return reply.code(404).send({ error: "Listing not found" });
    return listing;
  });

  app.post<{ Body: ListingInput }>("/listings", async (request) => {
    const p = await provider(request);
    const id = await createListing(request.supabase, p.id, request.body);
    return { id };
  });

  app.patch<{ Params: { id: string }; Body: ListingInput }>("/listings/:id", async (request) => {
    const p = await provider(request);
    await updateListing(request.supabase, p.id, request.params.id, request.body);
    return { ok: true };
  });

  app.patch<{ Params: { id: string }; Body: { paused: boolean } }>("/listings/:id/pause", async (request) => {
    const p = await provider(request);
    await setListingPaused(request.supabase, p.id, request.params.id, request.body.paused);
    return { ok: true };
  });

  app.delete<{ Params: { id: string } }>("/listings/:id", async (request) => {
    const p = await provider(request);
    await deleteListing(request.supabase, p.id, request.params.id);
    return { ok: true };
  });

  app.post<{ Params: { id: string } }>("/listings/:id/duplicate", async (request) => {
    const p = await provider(request);
    const id = await duplicateListing(request.supabase, p.id, request.params.id);
    return { id };
  });

  app.get<{ Params: { id: string } }>("/listings/:id/media", async (request) => {
    const p = await provider(request);
    return listMedia(request.supabase, p.id, request.params.id);
  });

  app.post<{ Params: { id: string } }>("/listings/:id/media", async (request) => {
    const p = await provider(request);
    const part = await request.file();
    if (!part) throw Object.assign(new Error("No file attached"), { statusCode: 400 });
    const file = await toFile(part);
    await uploadMedia(request.supabase, p.id, request.params.id, file);
    return { ok: true };
  });

  app.delete<{ Params: { id: string } }>("/media/:id", async (request) => {
    const p = await provider(request);
    await deleteMedia(request.supabase, p.id, request.params.id);
    return { ok: true };
  });

  app.get<{ Params: { id: string } }>("/listings/:id/availability", async (request) => {
    await provider(request);
    return listAvailability(request.supabase, request.params.id);
  });

  app.post<{ Params: { id: string }; Body: { startsAt: string; endsAt: string; note?: string } }>(
    "/listings/:id/availability",
    async (request) => {
      await provider(request);
      await blockUnavailable(request.supabase, {
        listingId: request.params.id,
        startsAt: request.body.startsAt,
        endsAt: request.body.endsAt,
        note: request.body.note,
      });
      return { ok: true };
    },
  );

  app.delete<{ Params: { id: string } }>("/availability/:id", async (request) => {
    await provider(request);
    await removeBlock(request.supabase, request.params.id);
    return { ok: true };
  });

  app.get("/orders", async (request) => {
    const p = await provider(request);
    return listProviderOrders(request.supabase, p.id);
  });

  app.post<{ Params: { id: string } }>("/orders/:id/accept", async (request) => {
    const p = await provider(request);
    await accept(request.supabase, p.id, request.params.id);
    return { ok: true };
  });

  app.post<{ Params: { id: string }; Body: { reason?: string } }>("/orders/:id/reject", async (request) => {
    const p = await provider(request);
    await reject(request.supabase, p.id, request.params.id, request.body?.reason);
    return { ok: true };
  });

  app.post<{ Params: { id: string } }>("/orders/:id/start", async (request) => {
    const p = await provider(request);
    await startWork(request.supabase, p.id, request.params.id);
    return { ok: true };
  });

  app.post<{ Params: { id: string }; Body: { code: string } }>("/orders/:id/complete", async (request) => {
    const p = await provider(request);
    return enterCompletionCode(request.supabase, p.id, request.params.id, request.body.code);
  });

  app.post<{ Params: { id: string }; Body: { message: string } }>("/orders/:id/report-problem", async (request) => {
    const p = await provider(request);
    await reportProblem(request.supabase, p.id, request.params.id, request.body.message);
    return { ok: true };
  });

  app.get("/wallet", async (request) => {
    const p = await provider(request);
    return getWallet(request.supabase, p.id);
  });

  app.get("/banks", async (request) => {
    await provider(request);
    return listBanks();
  });

  app.patch<{ Body: { bank_code: string; bank_account_number: string; bank_account_name: string } }>(
    "/wallet/bank",
    async (request) => {
      const p = await provider(request);
      await updateBankDetails(request.supabase, p.id, request.body);
      return { ok: true };
    },
  );

  app.get("/reviews", async (request) => {
    const p = await provider(request);
    return listMyReviews(request.supabase, p.id);
  });

  app.patch<{ Params: { id: string }; Body: { reply: string } }>("/reviews/:id/reply", async (request) => {
    const p = await provider(request);
    await replyToReview(request.supabase, p.id, request.params.id, request.body.reply);
    return { ok: true };
  });

  app.get("/subscription", async (request) => {
    await provider(request);
    return mySubscription(request.supabase);
  });
};

export default providerRoutes;

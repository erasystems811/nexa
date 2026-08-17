import { env } from "../../env.js";
import { createAdminClient } from "../../supabase.js";
import { toWhatsAppNumber } from "./phone.js";

/**
 * Outbound WhatsApp notifications only — ported from apps/customer's
 * modules/messaging/whatsapp.ts, which also runs the inbound bot/webhook
 * (cold discovery, conversation relay, phone-number scrubbing, etc). That
 * inbound side is NOT ported here; it still lives in apps/customer and stays
 * there, since it's the app receiving Meta's webhook calls. This file is
 * only the two outbound pings that api-server's own booking/offer flows
 * need, plus the send primitives and DB lookups they depend on.
 */

export function whatsappIsConfigured(): boolean {
  return Boolean(env.WHATSAPP_ACCESS_TOKEN && env.WHATSAPP_PHONE_NUMBER_ID);
}

// Meta's error code for "the 24-hour customer-service window is closed" — a
// plain text/button send is rejected outright, but a template message is
// exempt from the window, so it's the only thing that can still reach them.
const WINDOW_CLOSED = 131047;

async function callGraph(payload: Record<string, unknown>): Promise<{ ok: boolean; errorCode: number | null; detail: string }> {
  const response = await fetch(`https://graph.facebook.com/v20.0/${env.WHATSAPP_PHONE_NUMBER_ID}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.WHATSAPP_ACCESS_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ messaging_product: "whatsapp", ...payload }),
  });

  if (response.ok) return { ok: true, errorCode: null, detail: "" };

  const detail = await response.text();
  let errorCode: number | null = null;
  try {
    errorCode = (JSON.parse(detail) as { error?: { code?: number } }).error?.code ?? null;
  } catch {
    // Not JSON. The status code alone will have to do.
  }
  return { ok: false, errorCode, detail };
}

/**
 * The ping that reopens a closed window. `name` is who the message is about —
 * the other side's name, never their number.
 */
async function sendWhatsappTemplate(input: { to: string; name: string }): Promise<void> {
  const result = await callGraph({
    to: input.to,
    type: "template",
    template: {
      name: env.WHATSAPP_TEMPLATE_NAME,
      language: { code: env.WHATSAPP_TEMPLATE_LANG },
      components: [{ type: "body", parameters: [{ type: "text", text: input.name }] }],
    },
  });

  if (!result.ok) throw new Error(`WhatsApp template send failed: ${result.detail}`);
}

/**
 * Reply buttons (used for a quote's "Accept" and a booking's "Accept"/
 * "Decline"). Unlike text, a button can never go out as a template — a
 * closed window here is a real failure the caller must handle.
 */
async function sendWhatsappButtons(input: {
  to: string;
  body: string;
  buttons: Array<{ id: string; title: string }>;
}): Promise<{ ok: boolean; windowClosed: boolean }> {
  if (!env.WHATSAPP_ACCESS_TOKEN || !env.WHATSAPP_PHONE_NUMBER_ID) return { ok: false, windowClosed: false };

  const result = await callGraph({
    to: input.to,
    type: "interactive",
    interactive: {
      type: "button",
      body: { text: input.body },
      action: { buttons: input.buttons.map((b) => ({ type: "reply", reply: { id: b.id, title: b.title } })) },
    },
  });

  if (result.ok) return { ok: true, windowClosed: false };
  if (result.errorCode === WINDOW_CLOSED) return { ok: false, windowClosed: true };

  throw new Error(`WhatsApp button send failed: ${result.detail}`);
}

/**
 * Who to message and what to call them for a bound conversation's WhatsApp
 * thread — the customer and vendor sides, plus first-contact vendor binding
 * (a vendor's WhatsApp number is only ever discovered the first time a
 * message would go to them; once found it's bound to the thread so their own
 * plain-text reply is recognised next time instead of falling through to
 * cold discovery as a stranger).
 */
async function getWhatsappThreadContext(conversationId: string): Promise<{
  customerWaId: string | null;
  vendorWaId: string | null;
  customerName: string;
  vendorName: string;
} | null> {
  const db = createAdminClient();

  const { data: thread } = await db
    .from("whatsapp_threads")
    .select(
      "whatsapp_contact_id, provider_whatsapp_contact_id, conversations ( customer_id, provider_id, providers ( business_name ), profiles ( full_name ) )",
    )
    .eq("conversation_id", conversationId)
    .eq("status", "active")
    .maybeSingle();

  const customerContactId = thread?.whatsapp_contact_id;
  const providerContactId = thread?.provider_whatsapp_contact_id;
  const conversation = thread?.conversations;
  if (!customerContactId || !conversation?.customer_id) return null;

  const provider = conversation.providers as unknown as { business_name: string } | null;
  const customer = conversation.profiles as unknown as { full_name: string | null } | null;

  const contactIds = [customerContactId, providerContactId].filter(Boolean) as string[];
  const { data: contacts } = await db.from("whatsapp_contacts").select("id, wa_id").in("id", contactIds);
  const byId = new Map((contacts ?? []).map((c) => [c.id, c.wa_id]));

  let vendorWaId = providerContactId ? (byId.get(providerContactId) ?? null) : null;
  if (!vendorWaId && conversation.provider_id) {
    const { data: providerContact } = await db
      .from("provider_contacts")
      .select("contact_phone")
      .eq("provider_id", conversation.provider_id)
      .maybeSingle();
    vendorWaId = toWhatsAppNumber(providerContact?.contact_phone);

    if (vendorWaId) {
      const { data: existingVendorContact } = await db
        .from("whatsapp_contacts")
        .select("id")
        .eq("wa_id", vendorWaId)
        .maybeSingle();

      const vendorContactId =
        existingVendorContact?.id ??
        (await db.from("whatsapp_contacts").upsert({ wa_id: vendorWaId }, { onConflict: "wa_id" }).select("id").single())
          .data?.id;

      if (vendorContactId) {
        await db.from("whatsapp_threads").update({ provider_whatsapp_contact_id: vendorContactId }).eq("conversation_id", conversationId);
      }
    }
  }

  return {
    customerWaId: byId.get(customerContactId) ?? null,
    vendorWaId,
    customerName: customer?.full_name?.trim() || "there",
    vendorName: provider?.business_name?.trim() || "there",
  };
}

async function sendOfferAcceptButton(input: {
  offerId: string;
  conversationId: string;
  amountKobo: number;
  listingId: string;
}): Promise<void> {
  const db = createAdminClient();

  const context = await getWhatsappThreadContext(input.conversationId);
  if (!context?.customerWaId) return;

  const { data: listing } = await db.from("listings").select("title").eq("id", input.listingId).maybeSingle();
  const amountNaira = (input.amountKobo / 100).toLocaleString("en-NG");

  const result = await sendWhatsappButtons({
    to: context.customerWaId,
    body: `${context.vendorName} quoted ₦${amountNaira} for "${listing?.title ?? "your request"}". Accept?`,
    buttons: [{ id: input.offerId, title: "Accept" }],
  });

  if (result.windowClosed) {
    // Can't carry a button as a template. Nudge them instead; the button
    // itself goes out for real once they reply and the customer app's
    // resendPendingOfferButtonIfAny runs (that retry path is inbound-webhook
    // logic, so it stays in apps/customer).
    await sendWhatsappTemplate({ to: context.customerWaId, name: context.vendorName });
    return;
  }

  if (result.ok) {
    await db.from("price_offers").update({ whatsapp_notified_at: new Date().toISOString() }).eq("id", input.offerId);
  }
}

export async function notifyWhatsappOfferIfBound(input: {
  conversationId: string;
  offerId: string;
  amountKobo: number;
  listingId: string;
}): Promise<void> {
  if (!whatsappIsConfigured()) return;
  await sendOfferAcceptButton(input);
}

/**
 * A booking just became genuinely paid. This is the one thing that tells the
 * vendor a real booking now exists at all — without it, a vendor who only
 * ever uses WhatsApp would have no way to know "the customer accepted a
 * price" isn't the same as "there's a booking waiting for me to accept".
 *
 * Best-effort and silent for a vendor who was never WhatsApp-bound (a normal
 * web-only vendor still sees this exactly where they always have, in
 * Business Studio) — this only adds a second, WhatsApp-native way to see it.
 */
export async function notifyVendorOfNewBooking(bookingId: string): Promise<void> {
  if (!whatsappIsConfigured()) return;

  const db = createAdminClient();
  const { data: booking } = await db
    .from("bookings")
    .select("provider_id, scheduled_start, agreed_price_kobo, listings ( title )")
    .eq("id", bookingId)
    .maybeSingle();

  if (!booking) return;

  const { data: providerContact } = await db
    .from("provider_contacts")
    .select("contact_phone")
    .eq("provider_id", booking.provider_id)
    .maybeSingle();

  const vendorWaId = toWhatsAppNumber(providerContact?.contact_phone);
  if (!vendorWaId) return;

  const listingTitle = (booking.listings as unknown as { title: string } | null)?.title ?? "a listing";
  const amountNaira = (booking.agreed_price_kobo / 100).toLocaleString("en-NG");
  const when = new Date(booking.scheduled_start).toLocaleString("en-NG");

  const result = await sendWhatsappButtons({
    to: vendorWaId,
    body:
      `New paid booking! "${listingTitle}" for ${when} - ₦${amountNaira}, held safely by Nexa. ` +
      `The customer is waiting on you to accept or decline.`,
    buttons: [
      { id: `accept_booking:${bookingId}`, title: "Accept" },
      { id: `decline_booking:${bookingId}`, title: "Decline" },
    ],
  });

  if (result.windowClosed) {
    // Can't carry buttons as a template - nudge them, same as the offer flow.
    // Business Studio remains the reliable fallback for this one case; unlike
    // the offer-accept button, this isn't retried on the vendor's next reply
    // (that retry lives in apps/customer's inbound webhook handling).
    await sendWhatsappTemplate({ to: vendorWaId, name: "there" });
  }
}

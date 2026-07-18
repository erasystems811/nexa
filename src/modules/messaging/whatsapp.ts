import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { serverEnv, publicEnv } from "@/lib/env";
import type { ModerationFlagReason } from "@/lib/db/types";
import { toWhatsAppNumber } from "@/lib/phone";
import { createOrderAccessToken } from "@/lib/order-access";
import { scanMessageBody } from "./safety";
import { ensureWhatsappCustomer } from "@/modules/auth/whatsappProvisioning";
import { runColdDiscovery } from "@/modules/discovery";
import { acceptOfferAsAdmin, sendOfferAsAdmin } from "@/modules/bookings/offers";
import { checkout, cancelBookingByCustomer, BookingsError } from "@/modules/bookings";

interface WhatsappTextMessage {
  waId: string;
  displayName?: string;
  text: string;
  externalMessageId: string;
  businessPhoneId?: string;
}

type WhatsappSide = "customer" | "vendor";

export function whatsappIsConfigured(): boolean {
  const env = serverEnv();
  return Boolean(env.WHATSAPP_ACCESS_TOKEN && env.WHATSAPP_PHONE_NUMBER_ID);
}

export async function relayDashboardMessageToWhatsapp(input: {
  conversationId: string;
  senderId: string;
  body: string;
}): Promise<void> {
  if (!whatsappIsConfigured()) return;

  const context = await getWhatsappThreadContext(input.conversationId);
  if (!context) return;

  const side = input.senderId === context.customerId
    ? "customer"
    : input.senderId === context.providerUserId
      ? "vendor"
      : null;

  if (!side) return;

  const targetWaId = side === "customer" ? context.vendorWaId : context.customerWaId;
  if (!targetWaId) return;

  const body = formatRelayText(side, input.body, side === "customer" && context.vendorJustBound);

  await sendWhatsappText({
    to: targetWaId,
    body,
    nudgeName: side === "customer" ? context.vendorName : context.customerName,
  });
}


/**
 * The reference Nexa puts in the deep link: "Ref: <conversation id>".
 *
 * This is the whole trick, and it was the missing piece. A WhatsApp message
 * arrives carrying nothing but a phone number, and Nexa has to work out which
 * conversation, between which two people, it belongs to. The prefilled link is
 * the answer — and nothing read it, so every inbound message fell through to
 * "open your booking link first" and the relay never worked at all.
 */
const REFERENCE = /booking reference:?\s*([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i;

/**
 * A plain-language way out of a conversation, always available - a marketplace
 * bot can't be a one-way door. Matched at the start of the message so "start
 * over, I need a photographer instead" both exits AND hands the rest straight
 * to a fresh search, in one message.
 *
 * Deliberately does NOT include "cancel" - that word means "cancel my
 * booking" once one exists, and conflating the two would make a customer
 * trying to cancel a real, paid booking get bounced to search results
 * instead.
 */
const EXIT_COMMANDS = /^(menu|start over|new search|exit|end chat)\b[,:.]?\s*/i;

function parseExitIntent(text: string): { rest: string } | null {
  const trimmed = text.trim();
  const match = trimmed.match(EXIT_COMMANDS);
  if (!match) return null;
  return { rest: trimmed.slice(match[0].length).trim() };
}

/**
 * A vendor quoting straight from WhatsApp ("150k", "₦150,000", "quote 150000")
 * - deliberately anchored to the WHOLE message, not just anywhere a number
 *   appears, so an offhand mention of a number in an ordinary chat sentence
 *   ("I did 3 jobs last week") is never mistaken for a price. Returns kobo.
 */
const VENDOR_QUOTE =
  /^(?:quote|price|my price is|i can do(?: it)? for)?[:\s]*(?:₦|ngn|naira)?\s*([\d,]+(?:\.\d+)?)\s*(k)?\s*(?:naira|ngn|₦)?\.?$/i;

const SCHEDULE_EXAMPLE = "25/12/2026 6pm";

/**
 * Deliberately not a natural-language parser (native Date.parse rejects
 * almost every real phrasing a customer would actually type - "25 December
 * 2026, 6pm" and "tomorrow 6pm" both come back invalid). Asking for one exact
 * shape and parsing that shape reliably beats guessing at free text.
 */
function parseScheduledStart(text: string): string | null {
  const match = text
    .trim()
    .match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/i);
  if (!match) return null;

  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  let hour = Number(match[4]);
  const minute = match[5] ? Number(match[5]) : 0;
  const meridiem = match[6]?.toLowerCase();

  if (month < 1 || month > 12 || day < 1 || day > 31 || hour > 23 || minute > 59) return null;

  if (meridiem) {
    if (hour < 1 || hour > 12) return null;
    if (hour === 12) hour = meridiem === "pm" ? 12 : 0;
    else if (meridiem === "pm") hour += 12;
  }

  const date = new Date(year, month - 1, day, hour, minute);
  if (Number.isNaN(date.getTime()) || date.getTime() < Date.now()) return null;

  return date.toISOString();
}

function parseVendorQuote(text: string): number | null {
  const match = text.trim().match(VENDOR_QUOTE);
  if (!match) return null;

  const numeric = Number(match[1]!.replace(/,/g, ""));
  if (!Number.isFinite(numeric) || numeric <= 0) return null;

  const naira = match[2] ? numeric * 1000 : numeric;
  return Math.round(naira * 100);
}

/**
 * Bind a WhatsApp number to a conversation, once, on its first message.
 *
 * Knowing the reference is not proof on its own: a forwarded link would let a
 * stranger attach their number to someone else's conversation and read the rest
 * of it. So the number must match one Nexa already holds for that conversation —
 * the vendor's, from their application, or the customer's, from their account.
 *
 * The exception is a customer who never gave Nexa a number. There is nothing to
 * check them against, so the first number to use their private link claims the
 * thread, and Nexa writes it down so the second one cannot.
 */
async function bindThreadFromReference(input: {
  text: string;
  contactId: string;
  waId: string;
}): Promise<{ conversationId: string; side: WhatsappSide; senderId: string } | null | "wrong_number"> {
  const db = createAdminClient();

  const match = input.text.match(REFERENCE);
  if (!match) return null;
  const conversationId = match[1]!;

  const { data: conversation } = await db
    .from("conversations")
    .select("id, customer_id, provider_id, providers ( user_id ), profiles ( phone )")
    .eq("id", conversationId)
    .maybeSingle();

  if (!conversation) return null;

  const providerUserId =
    (conversation.providers as unknown as { user_id: string } | null)?.user_id ?? null;
  const customerPhone =
    (conversation.profiles as unknown as { phone: string | null } | null)?.phone ?? null;

  const { data: providerContact } = await db
    .from("provider_contacts")
    .select("contact_phone")
    .eq("provider_id", conversation.provider_id)
    .maybeSingle();

  const vendorWaId = toWhatsAppNumber(providerContact?.contact_phone);
  const customerWaId = toWhatsAppNumber(customerPhone);

  let side: WhatsappSide;
  if (vendorWaId && vendorWaId === input.waId) {
    side = "vendor";
  } else if (customerWaId && customerWaId === input.waId) {
    side = "customer";
  } else if (!customerWaId) {
    // No number on file to check against. The link is private, so the first
    // number to use it is the customer — and it is recorded here so that the
    // next number to try the same link is refused.
    side = "customer";
    await db.from("profiles").update({ phone: input.waId }).eq("id", conversation.customer_id);
  } else {
    await sendWhatsappText({
      to: input.waId,
      body: "This Nexa chat belongs to a different number. Please message from the phone number on your Nexa account.",
    });
    return "wrong_number";
  }

  const senderId = side === "vendor" ? providerUserId : conversation.customer_id;
  if (!senderId) return null;

  const { data: existing } = await db
    .from("whatsapp_threads")
    .select("id")
    .eq("conversation_id", conversationId)
    .maybeSingle();

  if (existing) {
    await db
      .from("whatsapp_threads")
      .update(
        side === "customer"
          ? { whatsapp_contact_id: input.contactId }
          : { provider_whatsapp_contact_id: input.contactId },
      )
      .eq("id", existing.id);
  } else {
    // whatsapp_contact_id is NOT NULL. A vendor who messages first still has to
    // fill it, so their own contact stands in until the customer arrives and
    // overwrites it.
    const { error } = await db.from("whatsapp_threads").insert({
      conversation_id: conversationId,
      whatsapp_contact_id: input.contactId,
      provider_whatsapp_contact_id: side === "vendor" ? input.contactId : null,
      status: "active",
    });
    if (error) return null;
  }

  return { conversationId, side, senderId };
}

export async function handleIncomingWhatsappText(input: WhatsappTextMessage): Promise<void> {
  const db = createAdminClient();
  const env = serverEnv();

  const { data: contact, error: contactError } = await db
    .from("whatsapp_contacts")
    .upsert(
      {
        wa_id: input.waId,
        display_name: input.displayName ?? null,
        phone_hint: maskPhone(input.waId),
        consent_at: new Date().toISOString(),
      },
      { onConflict: "wa_id" },
    )
    .select("id")
    .single();

  if (contactError || !contact) {
    throw new Error(`Could not record WhatsApp contact: ${contactError?.message}`);
  }

  const { data: thread } = await db
    .from("whatsapp_threads")
    .select(
      "id, conversation_id, whatsapp_contact_id, provider_whatsapp_contact_id, conversations ( customer_id, providers ( user_id ) )",
    )
    .or(`whatsapp_contact_id.eq.${contact.id},provider_whatsapp_contact_id.eq.${contact.id}`)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const conversation = thread?.conversations;
  const providerUserId = conversation?.providers?.user_id ?? null;
  const customerId = conversation?.customer_id ?? null;
  const side: WhatsappSide | null = thread?.whatsapp_contact_id === contact.id
    ? "customer"
    : thread?.provider_whatsapp_contact_id === contact.id
      ? "vendor"
      : null;
  const senderId = side === "customer" ? customerId : side === "vendor" ? providerUserId : null;

  let conversationId = thread?.conversation_id ?? null;
  let resolvedSide = side;
  let resolvedSenderId = senderId;

  // The first message from a number: bind it to the conversation its link names.
  if (!conversationId || !resolvedSenderId || !resolvedSide) {
    const bound = await bindThreadFromReference({
      text: input.text,
      contactId: contact.id,
      waId: input.waId,
    });

    // A Ref pointing to somebody else's conversation - bindThreadFromReference
    // has already told them why. Running discovery on top would be confusing.
    if (bound === "wrong_number") return;

    if (!bound) {
      // No conversation to continue, and no (working) link to one - the
      // stranger-with-no-account case discovery exists for.
      await runColdDiscovery({ waId: input.waId, text: input.text, contactId: contact.id });
      return;
    }

    conversationId = bound.conversationId;
    resolvedSide = bound.side;
    resolvedSenderId = bound.senderId;
  }

  // A customer must always be able to walk away, mid-negotiation or not - this
  // is a marketplace, not a single endless conversation. Checked before the
  // message is treated as chat, so it works no matter what stage they're at.
  if (resolvedSide === "customer") {
    const exit = parseExitIntent(input.text);
    if (exit) {
      await db.from("whatsapp_threads").update({ status: "closed" }).eq("conversation_id", conversationId);

      if (exit.rest) {
        await runColdDiscovery({ waId: input.waId, text: exit.rest, contactId: contact.id });
      } else {
        await sendWhatsappText({ to: input.waId, body: "No problem! What are you looking for now?" });
      }
      return;
    }
  }

  // "cancel" means cancel a paid booking, not leave the chat - kept separate
  // from EXIT_COMMANDS above for exactly that reason.
  if (resolvedSide === "customer" && /^cancel\b/i.test(input.text.trim())) {
    const handled = await tryCancelBookingFromWhatsapp({ conversationId, waId: input.waId });
    if (handled) return;
  }

  // An accepted offer with nothing booked yet means this reply is the date/
  // time answer, not ordinary chat - the whole point is that a customer never
  // has to leave WhatsApp to get from "agreed" to "paid".
  if (resolvedSide === "customer") {
    const pending = await findAcceptedOfferAwaitingCheckout(conversationId);
    if (pending) {
      const scheduledStart = parseScheduledStart(input.text);
      if (!scheduledStart) {
        await sendWhatsappText({
          to: input.waId,
          body: `I couldn't read that date. Please reply like: ${SCHEDULE_EXAMPLE}`,
        });
        return;
      }

      await completeCheckoutFromWhatsapp({ ...pending, waId: input.waId, scheduledStart });
      return;
    }
  }

  // A vendor should never have to leave WhatsApp to quote a price - if the
  // whole message reads as one, turn it into a real offer instead of just
  // relaying the raw text (the customer's Accept-button notification already
  // says the amount, so relaying the raw number too would just be noise).
  if (resolvedSide === "vendor") {
    const amountKobo = parseVendorQuote(input.text);
    if (amountKobo !== null) {
      const quoted = await tryQuoteFromVendorText({ conversationId, amountKobo, waId: input.waId });
      if (quoted) return;
    }
  }

  const reasons = scanMessageBody(input.text);
  if (reasons.length > 0) {
    await recordBlockedAttempt({
      conversationId,
      senderId: resolvedSenderId,
      whatsappContactId: contact.id,
      channel: resolvedSide === "customer" ? "whatsapp_customer" : "whatsapp_vendor",
      body: input.text,
      reasons,
    });
    await sendWhatsappText({
      to: input.waId,
      body: "For your safety, Nexa blocks phone numbers, account numbers, and direct-payment requests. Payments must stay inside Nexa escrow.",
    });
    return;
  }

  await db.from("messages").insert({
    conversation_id: conversationId,
    sender_id: resolvedSenderId,
    body: input.text,
    origin: resolvedSide === "customer" ? "whatsapp_customer" : "whatsapp_vendor",
    external_message_id: input.externalMessageId,
  });

  // A quote's "Accept" button may have failed to send earlier because the
  // customer's 24-hour window was closed - this message just reopened it, so
  // this is the moment to try again. Vendor messages don't reopen the
  // customer's window, so only worth checking on the customer's own message.
  if (resolvedSide === "customer") {
    await resendPendingOfferButtonIfAny(conversationId);
  }

  await db
    .from("whatsapp_threads")
    .update({
      business_phone_id: input.businessPhoneId ?? env.WHATSAPP_PHONE_NUMBER_ID ?? null,
      last_webhook_at: new Date().toISOString(),
    })
    .eq("conversation_id", conversationId);

  const context = await getWhatsappThreadContext(conversationId);
  const targetWaId: string | null | undefined =
    resolvedSide === "customer" ? context?.vendorWaId : context?.customerWaId;
  if (targetWaId && context) {
    await sendWhatsappText({
      to: targetWaId,
      body: formatRelayText(resolvedSide, input.text, resolvedSide === "customer" && context.vendorJustBound),
      // If their 24-hour window has shut, this is the name the template greets.
      nudgeName: resolvedSide === "customer" ? context.vendorName : context.customerName,
    });
  }
}

export async function recordBlockedAttempt(input: {
  conversationId: string;
  senderId: string | null;
  whatsappContactId?: string | null;
  channel: "nexa_dashboard" | "whatsapp_customer" | "whatsapp_vendor";
  body: string;
  reasons: ModerationFlagReason[];
}): Promise<void> {
  const db = createAdminClient();

  await db.from("blocked_message_attempts").insert({
    conversation_id: input.conversationId,
    sender_id: input.senderId,
    whatsapp_contact_id: input.whatsappContactId ?? null,
    channel: input.channel,
    body: input.body,
    reasons: input.reasons,
  });

  const senderId = input.senderId;
  if (senderId) {
    await db.from("moderation_flags").insert(
      input.reasons.map((reason) => ({
        conversation_id: input.conversationId,
        subject_id: senderId,
        reason,
        excerpt: input.body.slice(0, 280),
      })),
    );
  }
}

async function getWhatsappThreadContext(conversationId: string): Promise<{
  customerId: string;
  providerUserId: string | null;
  customerWaId: string | null;
  vendorWaId: string | null;
  /** Who the template greets. A name, never a number — that is the whole point. */
  customerName: string;
  vendorName: string;
  /** True exactly once: the first message this vendor has ever been relayed,
   * on any conversation - the moment to explain how replying and quoting
   * work, since nothing else ever tells them. */
  vendorJustBound: boolean;
} | null> {
  const db = createAdminClient();

  const { data: thread } = await db
    .from("whatsapp_threads")
    .select(
      "whatsapp_contact_id, provider_whatsapp_contact_id, conversations ( customer_id, provider_id, providers ( user_id, business_name ), profiles ( full_name ) )",
    )
    .eq("conversation_id", conversationId)
    .eq("status", "active")
    .maybeSingle();

  const customerContactId = thread?.whatsapp_contact_id;
  const providerContactId = thread?.provider_whatsapp_contact_id;
  const conversation = thread?.conversations;
  if (!customerContactId || !conversation?.customer_id) return null;

  const provider = conversation.providers as unknown as
    | { user_id: string; business_name: string }
    | null;
  const customer = conversation.profiles as unknown as { full_name: string | null } | null;

  const contactIds = [customerContactId, providerContactId].filter(Boolean) as string[];
  const { data: contacts } = await db
    .from("whatsapp_contacts")
    .select("id, wa_id")
    .in("id", contactIds);

  const byId = new Map((contacts ?? []).map((contact) => [contact.id, contact.wa_id]));

  // The vendor's WhatsApp is known from the thread once they've replied. Before
  // that — on the very first customer message — it is not, and the relay would
  // have nowhere to send. So fall back to the number the vendor gave on their
  // application. This is what lets the bot reach a vendor COLD: the first message
  // opens the conversation (via the approved template, since the vendor has never
  // messaged Nexa and their 24-hour window is shut), and everything after it
  // flows normally.
  let vendorWaId = providerContactId ? byId.get(providerContactId) ?? null : null;
  let vendorJustBound = false;
  if (!vendorWaId && conversation.provider_id) {
    const { data: providerContact } = await db
      .from("provider_contacts")
      .select("contact_phone")
      .eq("provider_id", conversation.provider_id)
      .maybeSingle();
    vendorWaId = toWhatsAppNumber(providerContact?.contact_phone);

    // The vendor has no equivalent of the customer's Ref-carrying link, so
    // this is the only moment their WhatsApp number is ever known: bind it to
    // this thread now, invisibly, so their reply (which is just plain text,
    // never a code) is recognised next time instead of falling through to
    // cold discovery as a stranger.
    if (vendorWaId) {
      const { data: existingVendorContact } = await db
        .from("whatsapp_contacts")
        .select("id")
        .eq("wa_id", vendorWaId)
        .maybeSingle();

      vendorJustBound = !existingVendorContact;

      const vendorContactId =
        existingVendorContact?.id ??
        (
          await db
            .from("whatsapp_contacts")
            .upsert({ wa_id: vendorWaId }, { onConflict: "wa_id" })
            .select("id")
            .single()
        ).data?.id;

      if (vendorContactId) {
        await db
          .from("whatsapp_threads")
          .update({ provider_whatsapp_contact_id: vendorContactId })
          .eq("conversation_id", conversationId);
      }
    }
  }

  return {
    customerId: conversation.customer_id,
    providerUserId: provider?.user_id ?? null,
    customerWaId: byId.get(customerContactId) ?? null,
    vendorWaId,
    customerName: customer?.full_name?.trim() || "there",
    vendorName: provider?.business_name?.trim() || "there",
    vendorJustBound,
  };
}

/**
 * WhatsApp will not let a business send free text to someone who has not messaged
 * it in the last 24 hours. Meta says so with error 131047.
 *
 * That rule is the difference between a relay that works and one that quietly
 * drops messages: a vendor who last replied on Tuesday cannot be reached on
 * Thursday, and without handling it, the customer's message would vanish with
 * nobody told. So when the window is shut, Nexa sends an approved template
 * instead — a plain "you have a new message" ping. The moment the vendor replies
 * to it, the window reopens and ordinary text flows again.
 */
const WINDOW_CLOSED = 131047;

async function callGraph(payload: Record<string, unknown>): Promise<{ ok: boolean; errorCode: number | null; detail: string }> {
  const env = serverEnv();

  const response = await fetch(
    `https://graph.facebook.com/v20.0/${env.WHATSAPP_PHONE_NUMBER_ID}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.WHATSAPP_ACCESS_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ messaging_product: "whatsapp", ...payload }),
    },
  );

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
  const env = serverEnv();

  const result = await callGraph({
    to: input.to,
    type: "template",
    template: {
      name: env.WHATSAPP_TEMPLATE_NAME,
      language: { code: env.WHATSAPP_TEMPLATE_LANG },
      components: [
        {
          type: "body",
          parameters: [{ type: "text", text: input.name }],
        },
      ],
    },
  });

  if (!result.ok) {
    throw new Error(`WhatsApp template send failed: ${result.detail}`);
  }
}

/**
 * `nudgeName` is used only if the 24-hour window has closed and the template has
 * to carry the message instead. Without it, a closed window is simply a failure.
 */
export async function sendWhatsappText(input: {
  to: string;
  body: string;
  nudgeName?: string;
}): Promise<void> {
  const env = serverEnv();
  if (!env.WHATSAPP_ACCESS_TOKEN || !env.WHATSAPP_PHONE_NUMBER_ID) return;

  const result = await callGraph({
    to: input.to,
    type: "text",
    text: { preview_url: false, body: input.body },
  });

  if (result.ok) return;

  if (result.errorCode === WINDOW_CLOSED && input.nudgeName) {
    // They have not spoken to Nexa in over a day. Tap them on the shoulder; the
    // message itself follows as soon as they reply and the window reopens.
    await sendWhatsappTemplate({ to: input.to, name: input.nudgeName });
    return;
  }

  throw new Error(`WhatsApp send failed: ${result.detail}`);
}

/**
 * A tappable list of up to 10 rows. Meta enforces 24 chars per row title and
 * 72 per row description - callers are expected to have already truncated,
 * since only they know what's safe to cut (a price vs. a name, say).
 *
 * There is no template fallback for a closed window here: cold discovery only
 * ever calls this in reply to a message that just arrived, so the window is
 * guaranteed open.
 */
export async function sendWhatsappList(input: {
  to: string;
  body: string;
  rows: Array<{ id: string; title: string; description: string }>;
  buttonLabel?: string;
}): Promise<void> {
  const env = serverEnv();
  if (!env.WHATSAPP_ACCESS_TOKEN || !env.WHATSAPP_PHONE_NUMBER_ID) return;

  const result = await callGraph({
    to: input.to,
    type: "interactive",
    interactive: {
      type: "list",
      body: { text: input.body },
      action: {
        button: input.buttonLabel ?? "View options",
        sections: [{ rows: input.rows }],
      },
    },
  });

  if (!result.ok) throw new Error(`WhatsApp list send failed: ${result.detail}`);
}

/**
 * Reply buttons (used for a quote's "Accept"). Unlike text, a button can never
 * go out as a template - Meta's template mechanism only carries text/media
 * bodies - so a closed window here is a real failure the caller must handle
 * (see resendPendingOfferButtonIfAny, which is what retries it).
 */
export async function sendWhatsappButtons(input: {
  to: string;
  body: string;
  buttons: Array<{ id: string; title: string }>;
}): Promise<{ ok: boolean; windowClosed: boolean }> {
  const env = serverEnv();
  if (!env.WHATSAPP_ACCESS_TOKEN || !env.WHATSAPP_PHONE_NUMBER_ID) return { ok: false, windowClosed: false };

  const result = await callGraph({
    to: input.to,
    type: "interactive",
    interactive: {
      type: "button",
      body: { text: input.body },
      action: {
        buttons: input.buttons.map((b) => ({ type: "reply", reply: { id: b.id, title: b.title } })),
      },
    },
  });

  if (result.ok) return { ok: true, windowClosed: false };
  if (result.errorCode === WINDOW_CLOSED) return { ok: false, windowClosed: true };

  throw new Error(`WhatsApp button send failed: ${result.detail}`);
}

/**
 * Opens (or reuses) the conversation for a listing a stranger just picked from
 * a cold-discovery list. Deliberately not the same getOrCreateConversation
 * used by the web app: that one runs under the caller's own session and RLS,
 * and there is no session here - this is the platform acting as itself,
 * exactly like the rest of this module already does for whatsapp_contacts and
 * whatsapp_threads.
 */
async function getOrCreateConversationAsAdmin(input: {
  customerId: string;
  providerId: string;
  listingId: string;
}): Promise<string> {
  const db = createAdminClient();

  const { data: existing } = await db
    .from("conversations")
    .select("id")
    .eq("customer_id", input.customerId)
    .eq("provider_id", input.providerId)
    .eq("listing_id", input.listingId)
    .maybeSingle();

  if (existing) return existing.id;

  const { data, error } = await db
    .from("conversations")
    .insert({
      customer_id: input.customerId,
      provider_id: input.providerId,
      listing_id: input.listingId,
    })
    .select("id")
    .single();

  if (error || !data) throw new Error(`Could not open the conversation: ${error?.message}`);
  return data.id;
}

/**
 * A stranger tapped a listing from their cold-discovery list. From here on
 * this is an ordinary conversation - the thread is bound directly (no Ref
 * needed, since there both sides are already known), so the customer's next
 * plain-text message hits the ordinary bound-thread relay path above.
 */
export async function handleListingSelected(input: { waId: string; listingId: string }): Promise<void> {
  const db = createAdminClient();

  const { data: contact } = await db
    .from("whatsapp_contacts")
    .select("id, display_name")
    .eq("wa_id", input.waId)
    .maybeSingle();

  if (!contact) return;

  const { data: listing } = await db
    .from("listings")
    .select("id, title, provider_id")
    .eq("id", input.listingId)
    .maybeSingle();

  if (!listing) {
    await sendWhatsappText({ to: input.waId, body: "That listing is no longer available. Try searching again." });
    return;
  }

  const { profileId } = await ensureWhatsappCustomer({
    waId: input.waId,
    contactId: contact.id,
    displayName: contact.display_name,
  });

  const conversationId = await getOrCreateConversationAsAdmin({
    customerId: profileId,
    providerId: listing.provider_id,
    listingId: listing.id,
  });

  const { data: existingThread } = await db
    .from("whatsapp_threads")
    .select("id")
    .eq("conversation_id", conversationId)
    .maybeSingle();

  // Picking the same listing again after "start over" (or any prior close)
  // reopens the same thread rather than orphaning it - conversation_id is
  // unique per thread, so there is exactly one row to reactivate, never a
  // duplicate to create.
  if (existingThread) {
    await db
      .from("whatsapp_threads")
      .update({ whatsapp_contact_id: contact.id, status: "active" })
      .eq("id", existingThread.id);
  } else {
    await db.from("whatsapp_threads").insert({
      conversation_id: conversationId,
      whatsapp_contact_id: contact.id,
      status: "active",
    });
  }

  const { data: provider } = await db
    .from("providers")
    .select("business_name")
    .eq("id", listing.provider_id)
    .maybeSingle();

  await sendWhatsappText({
    to: input.waId,
    body:
      `You're connected with ${provider?.business_name ?? "the vendor"} about "${listing.title}". Ask away!\n\n` +
      KEYWORD_GLOSSARY,
  });
}

/**
 * Told once, right as a conversation actually begins - not left for a
 * customer to discover by accident, and not repeated on every message either.
 *
 * Only two words taught here on purpose, even though the code also quietly
 * accepts a few natural synonyms ("start over", "exit", "end chat" all do the
 * same thing as "menu") - teaching one clear word per action beats listing
 * every alias and making the customer pick.
 */
const KEYWORD_GLOSSARY =
  `Two things you can type anytime:\n` +
  `• "menu" — leave this chat and search for something else\n` +
  `• "cancel" — cancel a booking you've already paid for, for a full refund`;

/**
 * Sends (or re-sends) the WhatsApp-native "Accept" button for a pending offer,
 * and stamps whatsapp_notified_at only once it actually goes out - a closed
 * window leaves it null so resendPendingOfferButtonIfAny tries again later.
 */
async function sendOfferAcceptButton(input: {
  offerId: string;
  conversationId: string;
  amountKobo: number;
  listingId: string;
}): Promise<void> {
  const db = createAdminClient();

  const context = await getWhatsappThreadContext(input.conversationId);
  if (!context?.customerWaId) return;

  const { data: listing } = await db
    .from("listings")
    .select("title")
    .eq("id", input.listingId)
    .maybeSingle();

  const amountNaira = (input.amountKobo / 100).toLocaleString("en-NG");

  const result = await sendWhatsappButtons({
    to: context.customerWaId,
    body: `${context.vendorName} quoted ₦${amountNaira} for "${listing?.title ?? "your request"}". Accept?`,
    buttons: [{ id: input.offerId, title: "Accept" }],
  });

  if (result.windowClosed) {
    // Can't carry a button as a template. Nudge them instead; the button
    // itself goes out for real once they reply and resendPendingOfferButtonIfAny runs.
    await sendWhatsappTemplate({ to: context.customerWaId, name: context.vendorName });
    return;
  }

  if (result.ok) {
    await db.from("price_offers").update({ whatsapp_notified_at: new Date().toISOString() }).eq("id", input.offerId);
  }
}

/**
 * A vendor's WhatsApp message just parsed as a price quote - turns it into a
 * real price_offers row instead of a relayed chat message. Returns false when
 * there's no listing to quote against (a listing-less "chat about the
 * business" conversation), so the caller falls through to an ordinary relay.
 */
async function tryQuoteFromVendorText(input: {
  conversationId: string;
  amountKobo: number;
  waId: string;
}): Promise<boolean> {
  const db = createAdminClient();

  const { data: conversation } = await db
    .from("conversations")
    .select("listing_id, customer_id, provider_id")
    .eq("id", input.conversationId)
    .maybeSingle();

  if (!conversation?.listing_id) return false;

  await sendOfferAsAdmin({
    conversationId: input.conversationId,
    listingId: conversation.listing_id,
    providerId: conversation.provider_id,
    customerId: conversation.customer_id,
    amountKobo: input.amountKobo,
  });

  await sendWhatsappText({
    to: input.waId,
    body: `Quote sent: ₦${(input.amountKobo / 100).toLocaleString("en-NG")}. I'll let you know as soon as the customer responds.`,
  });

  return true;
}

/**
 * An offer this customer accepted, for a listing they haven't actually booked
 * yet - the signal that their next message is a date/time answer, not chat.
 * No extra state to track: once checkout() below creates the booking, this
 * naturally stops matching anything on its own.
 */
/**
 * "cancel" typed on the conversation for a booking that's actually theirs -
 * cancelBookingByCustomer itself enforces the paid_held-only rule, so this is
 * just finding the right booking and turning its answer into a reply.
 */
async function tryCancelBookingFromWhatsapp(input: {
  conversationId: string;
  waId: string;
}): Promise<boolean> {
  const db = createAdminClient();

  const { data: conversation } = await db
    .from("conversations")
    .select("customer_id, listing_id")
    .eq("id", input.conversationId)
    .maybeSingle();

  if (!conversation?.listing_id) return false;

  const { data: booking } = await db
    .from("bookings")
    .select("id")
    .eq("customer_id", conversation.customer_id)
    .eq("listing_id", conversation.listing_id)
    .neq("status", "cancelled")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!booking) {
    await sendWhatsappText({ to: input.waId, body: "I don't see a booking to cancel here." });
    return true;
  }

  try {
    await cancelBookingByCustomer(booking.id);
    await sendWhatsappText({ to: input.waId, body: "Done - your booking is cancelled and refunded in full." });
  } catch (error) {
    await sendWhatsappText({
      to: input.waId,
      body: error instanceof BookingsError ? error.message : "I couldn't cancel that booking - please try again.",
    });
  }

  return true;
}

async function findAcceptedOfferAwaitingCheckout(conversationId: string): Promise<{
  listingId: string;
  customerId: string;
} | null> {
  const db = createAdminClient();

  const { data: offer } = await db
    .from("price_offers")
    .select("listing_id, customer_id")
    .eq("conversation_id", conversationId)
    .eq("status", "accepted")
    .order("accepted_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!offer) return null;

  const { data: existingBooking } = await db
    .from("bookings")
    .select("id")
    .eq("customer_id", offer.customer_id)
    .eq("listing_id", offer.listing_id)
    .neq("status", "cancelled")
    .limit(1)
    .maybeSingle();

  if (existingBooking) return null;

  return { listingId: offer.listing_id, customerId: offer.customer_id };
}

/**
 * The one unavoidable step off WhatsApp: a card number can never be typed
 * safely into a chat, so paying has to happen on a real, secure page. This is
 * the only handoff - no login, no orders page, just a single link straight to
 * the payment provider. checkout() is driven with the admin client standing
 * in for a browser session; the pricing trigger and RLS both still see a real
 * customer_id, so nothing about the money path is any different from a web
 * checkout.
 */
async function completeCheckoutFromWhatsapp(input: {
  waId: string;
  scheduledStart: string;
  listingId: string;
  customerId: string;
}): Promise<void> {
  const db = createAdminClient();
  const { data: profile } = await db
    .from("profiles")
    .select("full_name")
    .eq("id", input.customerId)
    .maybeSingle();

  const trackingUrlFor = (bookingId: string) =>
    `${publicEnv.NEXT_PUBLIC_SITE_URL}/track/${bookingId}?t=${createOrderAccessToken(bookingId)}`;

  try {
    const result = await checkout(
      {
        listingId: input.listingId,
        scheduledStart: input.scheduledStart,
        // A WhatsApp-only customer has no session, so the gateway must send
        // them back to the no-login tracking link, not the login-gated
        // /orders page a web customer would land on.
        buildRedirectUrl: trackingUrlFor,
      },
      {
        id: input.customerId,
        // No real email exists for a WhatsApp-only account - this is never
        // sent to, only used to satisfy the payment gateway's required field.
        email: `wa-${input.waId}@guest.nexa.app`,
        name: profile?.full_name ?? undefined,
      },
      db,
    );

    await sendWhatsappText({
      to: input.waId,
      body: result.checkoutUrl
        ? `Almost there - tap to pay: ${result.checkoutUrl}`
        : `Payment received! Your booking is confirmed. Track it anytime here: ${trackingUrlFor(result.bookingId)}`,
    });
  } catch (error) {
    await sendWhatsappText({
      to: input.waId,
      body: `Sorry, I couldn't complete that booking: ${error instanceof BookingsError ? error.message : "please try again"}`,
    });
  }
}

/**
 * Best-effort hook for sendOffer() (src/modules/bookings/offers.ts): if this
 * conversation is WhatsApp-bound, the customer - who has no browser session -
 * gets a native Accept button alongside the vendor's quote appearing in the
 * relayed chat text.
 */
export async function notifyWhatsappOfferIfBound(input: {
  conversationId: string;
  offerId: string;
  amountKobo: number;
  listingId: string;
}): Promise<void> {
  if (!whatsappIsConfigured()) return;
  await sendOfferAcceptButton(input);
}

/** Called after every inbound customer text - see handleIncomingWhatsappText. */
async function resendPendingOfferButtonIfAny(conversationId: string): Promise<void> {
  if (!whatsappIsConfigured()) return;

  const db = createAdminClient();
  const { data: offer } = await db
    .from("price_offers")
    .select("id, amount_kobo, listing_id")
    .eq("conversation_id", conversationId)
    .eq("status", "pending")
    .is("whatsapp_notified_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!offer) return;

  await sendOfferAcceptButton({
    conversationId,
    offerId: offer.id,
    amountKobo: offer.amount_kobo,
    listingId: offer.listing_id,
  });
}

/**
 * A tap on the offer's "Accept" button. There is no session to authorise this
 * with, so the check is done by hand: the offer must still be pending, and the
 * tapping number must resolve to the same customer the offer was made to -
 * standing in for the RLS check `acceptOffer` normally relies on.
 */
export async function handleOfferButtonReply(input: { waId: string; buttonId: string }): Promise<void> {
  const db = createAdminClient();

  const { data: offer } = await db
    .from("price_offers")
    .select("id, status, customer_id")
    .eq("id", input.buttonId)
    .maybeSingle();

  if (!offer || offer.status !== "pending") return;

  const { data: contact } = await db
    .from("whatsapp_contacts")
    .select("profile_id")
    .eq("wa_id", input.waId)
    .maybeSingle();

  if (!contact?.profile_id || contact.profile_id !== offer.customer_id) return;

  await acceptOfferAsAdmin(offer.id);

  await sendWhatsappText({
    to: input.waId,
    body: `Offer accepted! What date and time is this for?\n\nReply like: ${SCHEDULE_EXAMPLE}`,
  });
}

function formatRelayText(from: WhatsappSide, body: string, explainToVendor = false): string {
  const label = from === "customer" ? "Customer" : "Vendor";
  const relayed = `${label} via Nexa:\n${body}`;

  if (!explainToVendor) return relayed;

  // The vendor's very first message ever through Nexa - nothing else tells
  // them replying works like normal WhatsApp, or that a price is just typed
  // as an amount, so this is the one place it has to be said.
  return (
    `${relayed}\n\n` +
    `(This is a customer inquiry through Nexa - reply normally to chat with them. ` +
    `When you're ready to name a price, reply with just the number, no other words - ` +
    `e.g. "150000" or "150k".)`
  );
}

function maskPhone(value: string): string {
  if (value.length <= 6) return value;
  return `${value.slice(0, 4)}***${value.slice(-3)}`;
}

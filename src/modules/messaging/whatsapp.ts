import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { serverEnv } from "@/lib/env";
import type { ModerationFlagReason } from "@/lib/db/types";
import { toWhatsAppNumber } from "@/lib/phone";
import { scanMessageBody } from "./safety";

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

  await sendWhatsappText({
    to: targetWaId,
    body: formatRelayText(side, input.body),
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
const REFERENCE = /Ref:\s*([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i;

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
}): Promise<{ conversationId: string; side: WhatsappSide; senderId: string } | null> {
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
    return null;
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

    if (!bound) {
      await sendWhatsappText({
        to: input.waId,
        body:
          "Thanks for messaging Nexa. Please open your Nexa booking link first so this WhatsApp chat can be linked safely.",
      });
      return;
    }

    conversationId = bound.conversationId;
    resolvedSide = bound.side;
    resolvedSenderId = bound.senderId;
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
  if (targetWaId) {
    await sendWhatsappText({
      to: targetWaId,
      body: formatRelayText(resolvedSide, input.text),
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
} | null> {
  const db = createAdminClient();

  const { data: thread } = await db
    .from("whatsapp_threads")
    .select(
      "whatsapp_contact_id, provider_whatsapp_contact_id, conversations ( customer_id, providers ( user_id ) )",
    )
    .eq("conversation_id", conversationId)
    .eq("status", "active")
    .maybeSingle();

  const customerContactId = thread?.whatsapp_contact_id;
  const providerContactId = thread?.provider_whatsapp_contact_id;
  const conversation = thread?.conversations;
  if (!customerContactId || !conversation?.customer_id) return null;

  const contactIds = [customerContactId, providerContactId].filter(Boolean) as string[];
  const { data: contacts } = await db
    .from("whatsapp_contacts")
    .select("id, wa_id")
    .in("id", contactIds);

  const byId = new Map((contacts ?? []).map((contact) => [contact.id, contact.wa_id]));

  return {
    customerId: conversation.customer_id,
    providerUserId: conversation.providers?.user_id ?? null,
    customerWaId: byId.get(customerContactId) ?? null,
    vendorWaId: providerContactId ? byId.get(providerContactId) ?? null : null,
  };
}

async function sendWhatsappText(input: { to: string; body: string }): Promise<void> {
  const env = serverEnv();
  if (!env.WHATSAPP_ACCESS_TOKEN || !env.WHATSAPP_PHONE_NUMBER_ID) return;

  const response = await fetch(
    `https://graph.facebook.com/v20.0/${env.WHATSAPP_PHONE_NUMBER_ID}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.WHATSAPP_ACCESS_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: input.to,
        type: "text",
        text: { preview_url: false, body: input.body },
      }),
    },
  );

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`WhatsApp send failed: ${detail}`);
  }
}

function formatRelayText(from: WhatsappSide, body: string): string {
  const label = from === "customer" ? "Customer" : "Vendor";
  return `${label} via Nexa:\n${body}`;
}

function maskPhone(value: string): string {
  if (value.length <= 6) return value;
  return `${value.slice(0, 4)}***${value.slice(-3)}`;
}

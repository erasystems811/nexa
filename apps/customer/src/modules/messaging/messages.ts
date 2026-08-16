import "server-only";

import { createClient } from "@/lib/supabase/server";
import { MessagingError, type ChatMessage } from "./types";
import type { ModerationFlagReason } from "@/lib/db/types";
import { scanMessageBody } from "./safety";
import { recordBlockedAttempt, relayDashboardMessageToWhatsapp } from "./whatsapp";
import { isEnabled, FLAGS } from "@/modules/settings/flags";

/**
 * Sending and reading messages.
 *
 * The database still scans every inserted row as a backstop. The app path is
 * stricter: phone numbers, account numbers, and direct-payment attempts are
 * blocked before the other side sees them, then surfaced to Admin.
 */

export async function sendMessage(input: {
  conversationId: string;
  senderId: string;
  body: string;
}): Promise<ChatMessage> {
  const body = input.body.trim();
  if (!body) throw new MessagingError("A message cannot be empty");
  if (body.length > 4000) throw new MessagingError("That message is too long");

  const blockedReasons = scanMessageBody(body);
  if (blockedReasons.length > 0) {
    await recordBlockedAttempt({
      conversationId: input.conversationId,
      senderId: input.senderId,
      channel: "nexa_dashboard",
      body,
      reasons: blockedReasons,
    });
    throw new MessagingError(
      "That message includes contact or payment details. Keep payment inside Nexa escrow so both sides stay protected.",
    );
  }

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("messages")
    .insert({
      conversation_id: input.conversationId,
      sender_id: input.senderId,
      body,
    })
    .select("id, conversation_id, sender_id, body, is_flagged, flag_reasons, read_at, created_at")
    .single();

  if (error || !data) {
    throw new MessagingError(`Message not sent: ${error?.message}`);
  }

  if (await isEnabled(FLAGS.whatsappMediatedChat)) {
    await relayDashboardMessageToWhatsapp({
      conversationId: input.conversationId,
      senderId: input.senderId,
      body,
    });
  }

  return toChatMessage(data);
}

export async function listMessages(conversationId: string): Promise<ChatMessage[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("messages")
    .select("id, conversation_id, sender_id, body, is_flagged, flag_reasons, read_at, created_at")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });

  if (error) throw new MessagingError(`Could not load messages: ${error.message}`);
  return (data ?? []).map(toChatMessage);
}

/** Marks the counterpart's messages read. RLS forbids marking your own. */
export async function markConversationRead(
  conversationId: string,
  readerId: string,
): Promise<void> {
  const supabase = await createClient();
  await supabase
    .from("messages")
    .update({ read_at: new Date().toISOString() })
    .eq("conversation_id", conversationId)
    .neq("sender_id", readerId)
    .is("read_at", null);
}

function toChatMessage(row: {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string;
  is_flagged: boolean;
  flag_reasons: ModerationFlagReason[] | null;
  read_at: string | null;
  created_at: string;
}): ChatMessage {
  return {
    id: row.id,
    conversationId: row.conversation_id,
    senderId: row.sender_id,
    body: row.body,
    isFlagged: row.is_flagged,
    flagReasons: row.flag_reasons ?? [],
    readAt: row.read_at,
    createdAt: row.created_at,
  };
}

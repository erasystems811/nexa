"use server";

import { revalidatePath } from "next/cache";
import { requireSession, requireRole } from "@/modules/auth";
import {
  endMaskedCall,
  getOrCreateConversation,
  markConversationRead,
  resolveFlag,
  sendMessage,
  startMaskedCall,
  MessagingError,
} from ".";
import type { CallTicket } from "./types";

export interface SendState {
  error?: string;
  /** Set when the sent message tripped the contact-info scanner. */
  warning?: string;
}

/**
 * PRD Section 08: a flagged message still sends. The sender is told it was
 * flagged rather than left to wonder why nothing happened — silent moderation
 * is how people learn to evade rather than stop.
 */
export async function sendMessageAction(
  _prev: SendState,
  formData: FormData,
): Promise<SendState> {
  const { userId } = await requireSession();
  const conversationId = String(formData.get("conversationId") ?? "");
  const body = String(formData.get("body") ?? "");

  try {
    const message = await sendMessage({ conversationId, senderId: userId, body });
    revalidatePath(`/messages/${conversationId}`);

    if (message.isFlagged) {
      return {
        warning:
          "Sent. This message mentioned contact or payment details, so it has been " +
          "flagged for review. Keep payments on Nexa — that is what protects you both.",
      };
    }
    return {};
  } catch (error) {
    return { error: error instanceof MessagingError ? error.message : "Message not sent" };
  }
}

export async function startConversationAction(
  providerId: string,
  listingId?: string,
): Promise<string> {
  const { userId } = await requireSession();
  return getOrCreateConversation({ customerId: userId, providerId, listingId });
}

export async function markReadAction(conversationId: string): Promise<void> {
  const { userId } = await requireSession();
  await markConversationRead(conversationId, userId);
}

export interface CallState {
  error?: string;
  ticket?: CallTicket;
}

export async function startCallAction(
  _prev: CallState,
  formData: FormData,
): Promise<CallState> {
  const { userId } = await requireSession();
  const conversationId = String(formData.get("conversationId") ?? "");

  try {
    const ticket = await startMaskedCall({ conversationId, callerId: userId });
    return { ticket };
  } catch (error) {
    return {
      error: error instanceof MessagingError ? error.message : "Could not start the call",
    };
  }
}

export async function endCallAction(callSessionId: string): Promise<void> {
  const { userId } = await requireSession();
  await endMaskedCall(callSessionId, userId);
}

export async function resolveFlagAction(
  flagId: string,
  decision: "confirmed" | "dismissed",
): Promise<void> {
  const { profile } = await requireRole("admin");
  await resolveFlag(flagId, decision, { id: profile.id, role: profile.role });
  revalidatePath("/admin/moderation");
}

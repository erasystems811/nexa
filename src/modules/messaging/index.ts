/**
 * Messaging records for WhatsApp-through-Nexa communication.
 *
 * Nexa no longer exposes an in-app chat or call screen. Conversations and
 * messages remain the internal system of record for WhatsApp relays, escrow
 * moderation, price offers, and admin review.
 */
export {
  getOrCreateConversation,
  listConversations,
  getConversation,
} from "./conversations";

export { sendMessage, listMessages, markConversationRead } from "./messages";

export { listPendingFlags, resolveFlag, type ModerationFlagRow } from "./moderation";

export {
  MessagingError,
  type ChatMessage,
  type ConversationSummary,
} from "./types";

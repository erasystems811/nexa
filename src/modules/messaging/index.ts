/**
 * Messaging — in-app chat, masked calling, contact-info flagging. PRD Section 08.
 *
 * Owns: conversations, messages, call_sessions, moderation_flags.
 *
 * A shared module. The Marketplace (customer) and Business Studio (provider)
 * both call these functions; neither owns them, and nothing here knows which
 * surface is calling.
 *
 * `telephony/` is private, the same way `payments/gateway/` is. ESLint blocks
 * importing it from anywhere else, so no future feature can place a call that
 * exposes a real phone number.
 *
 * The scanner is NOT in this module. It lives in a database trigger, where a
 * client that bypasses this module still cannot bypass it. A detected phone or
 * bank number is flagged for Admin, never silently blocked: false positives
 * happen, and a blocked message only teaches people to evade.
 */
export {
  getOrCreateConversation,
  listConversations,
  getConversation,
} from "./conversations";

export { sendMessage, listMessages, markConversationRead } from "./messages";

export { startMaskedCall, endMaskedCall } from "./calls";

export { listPendingFlags, resolveFlag, type ModerationFlagRow } from "./moderation";

export {
  MessagingError,
  type ChatMessage,
  type ConversationSummary,
  type CallTicket,
} from "./types";

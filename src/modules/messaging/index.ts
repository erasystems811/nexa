/**
 * Messaging — in-app chat, masked calling, contact-info flagging. PRD Section 08.
 *
 * Owns: conversations, messages, call_sessions, moderation_flags.
 *
 * A detected phone or bank number is flagged for Admin, not silently blocked:
 * false positives happen, and a blocked message teaches people to evade.
 * Phase 1: empty.
 */
export {};

import type { ModerationFlagReason } from "@/lib/db/types";

export interface ConversationSummary {
  id: string;
  customerId: string;
  providerId: string;
  listingId: string | null;
  bookingId: string | null;
  lastMessageAt: string | null;
  /** The other party's display name, from the caller's point of view. */
  counterpartName: string;
  unreadCount: number;
}

export interface ChatMessage {
  id: string;
  conversationId: string;
  senderId: string;
  body: string;
  isFlagged: boolean;
  flagReasons: ModerationFlagReason[];
  readAt: string | null;
  createdAt: string;
}

/**
 * What the caller is told to dial. Only ever a proxy number — the counterpart's
 * real number is not in this object, and has no path to a browser.
 */
export interface CallTicket {
  callSessionId: string;
  dialNumber: string;
  expiresAt: string;
}

export class MessagingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MessagingError";
  }
}

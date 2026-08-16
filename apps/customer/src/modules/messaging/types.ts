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


export class MessagingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MessagingError";
  }
}

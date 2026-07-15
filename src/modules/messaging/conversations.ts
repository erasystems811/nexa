import "server-only";

import { createClient } from "@/lib/supabase/server";
import { MessagingError, type ConversationSummary } from "./types";

/**
 * Conversations are between a customer and a provider, optionally about a
 * specific listing or booking Nothing here is aware of the
 * Marketplace or Business Studio — both call the same functions, and each
 * caller's own row-level policies decide what they can see.
 */

/**
 * Opens the conversation for this (customer, provider, listing) triple, or
 * returns the existing one. The partial unique indexes in 0013 make the
 * "existing one" well-defined even when listingId is null.
 */
export async function getOrCreateConversation(input: {
  customerId: string;
  providerId: string;
  listingId?: string | null;
  bookingId?: string | null;
}): Promise<string> {
  const supabase = await createClient();

  const query = supabase
    .from("conversations")
    .select("id")
    .eq("customer_id", input.customerId)
    .eq("provider_id", input.providerId);

  const { data: existing } = await (input.listingId
    ? query.eq("listing_id", input.listingId)
    : query.is("listing_id", null)
  ).maybeSingle();

  if (existing) return existing.id;

  const { data, error } = await supabase
    .from("conversations")
    .insert({
      customer_id: input.customerId,
      provider_id: input.providerId,
      listing_id: input.listingId ?? null,
      booking_id: input.bookingId ?? null,
    })
    .select("id")
    .single();

  if (error || !data) {
    throw new MessagingError(`Could not open the conversation: ${error?.message}`);
  }

  return data.id;
}

/**
 * The caller's conversations. RLS restricts the rows; this only decides which
 * side of each one the caller is on, so the list shows the *other* person.
 */
export async function listConversations(userId: string): Promise<ConversationSummary[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("conversations")
    .select(
      `id, customer_id, provider_id, listing_id, booking_id, last_message_at,
       providers ( business_name ),
       profiles!conversations_customer_id_fkey ( full_name )`,
    )
    .order("last_message_at", { ascending: false, nullsFirst: false });

  if (error) throw new MessagingError(`Could not load conversations: ${error.message}`);

  const rows = (data ?? []) as unknown as Array<{
    id: string;
    customer_id: string;
    provider_id: string;
    listing_id: string | null;
    booking_id: string | null;
    last_message_at: string | null;
    providers: { business_name: string } | null;
    profiles: { full_name: string | null } | null;
  }>;

  // One query for all unread counts rather than one per conversation.
  const { data: unread } = await supabase
    .from("messages")
    .select("conversation_id")
    .neq("sender_id", userId)
    .is("read_at", null);

  const unreadByConversation = new Map<string, number>();
  for (const m of (unread ?? []) as Array<{ conversation_id: string }>) {
    unreadByConversation.set(
      m.conversation_id,
      (unreadByConversation.get(m.conversation_id) ?? 0) + 1,
    );
  }

  return rows.map((r) => {
    const viewerIsCustomer = r.customer_id === userId;
    return {
      id: r.id,
      customerId: r.customer_id,
      providerId: r.provider_id,
      listingId: r.listing_id,
      bookingId: r.booking_id,
      lastMessageAt: r.last_message_at,
      counterpartName: viewerIsCustomer
        ? (r.providers?.business_name ?? "Provider")
        : (r.profiles?.full_name ?? "Customer"),
      unreadCount: unreadByConversation.get(r.id) ?? 0,
    };
  });
}

/** Returns null when the caller is not a participant — RLS filters the row out. */
export async function getConversation(conversationId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("conversations")
    .select("id, customer_id, provider_id, listing_id, booking_id, providers ( business_name ), listings ( title )")
    .eq("id", conversationId)
    .maybeSingle();
  return data;
}

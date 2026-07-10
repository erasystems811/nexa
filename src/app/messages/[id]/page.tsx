import { notFound } from "next/navigation";
import { requireSession } from "@/modules/auth";
import {
  getConversation,
  listConversations,
  listMessages,
  markConversationRead,
} from "@/modules/messaging";
import { listOffers } from "@/modules/bookings";
import { Thread } from "./thread";
import { Offers } from "./offers";

export default async function ConversationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { userId } = await requireSession();

  // RLS returns nothing when the caller is not a participant, so a stranger
  // with a valid conversation id gets a 404 rather than a 403 that confirms it
  // exists.
  const conversation = await getConversation(id);
  if (!conversation) notFound();

  const [messages, conversations, offers] = await Promise.all([
    listMessages(id),
    listConversations(userId),
    listOffers(id),
  ]);

  await markConversationRead(id, userId);

  const counterpartName =
    conversations.find((c) => c.id === id)?.counterpartName ?? "Conversation";
  const viewerIsProvider = conversation.customer_id !== userId;

  return (
    <main className="mx-auto max-w-2xl">
      <Offers
        conversationId={id}
        listingId={conversation.listing_id}
        viewerIsProvider={viewerIsProvider}
        offers={offers}
      />
      <Thread
        conversationId={id}
        viewerId={userId}
        counterpartName={counterpartName}
        initialMessages={messages}
      />
    </main>
  );
}

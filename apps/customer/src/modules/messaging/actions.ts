"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireRole, requireSession } from "@/modules/auth";
import { getOrCreateConversation, resolveFlag } from ".";

export async function startConversationAction(
  providerId: string,
  listingId?: string,
): Promise<string> {
  const { userId } = await requireSession();
  return getOrCreateConversation({ customerId: userId, providerId, listingId });
}

/**
 * "Chat on WhatsApp" from a vendor's profile — a conversation about the business
 * rather than about one listing.
 *
 * conversations.listing_id is nullable and 0013's conversations_unique_without_listing
 * index makes the listing-less conversation between a customer and a vendor
 * well-defined, so there is exactly one of these per pair and no schema change
 * is needed.
 */
export async function discussProviderAction(formData: FormData): Promise<void> {
  const { userId } = await requireSession();
  const providerId = String(formData.get("providerId") ?? "");
  if (!providerId) throw new Error("That vendor is not available");

  const conversationId = await getOrCreateConversation({
    customerId: userId,
    providerId,
    listingId: null,
  });

  redirect(`/whatsapp/${conversationId}`);
}

export async function resolveFlagAction(
  flagId: string,
  decision: "confirmed" | "dismissed",
): Promise<void> {
  const { profile } = await requireRole("admin");
  await resolveFlag(flagId, decision, { id: profile.id, role: profile.role });
  revalidatePath("/admin/moderation");
}

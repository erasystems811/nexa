"use server";

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

export async function resolveFlagAction(
  flagId: string,
  decision: "confirmed" | "dismissed",
): Promise<void> {
  const { profile } = await requireRole("admin");
  await resolveFlag(flagId, decision, { id: profile.id, role: profile.role });
  revalidatePath("/admin/moderation");
}

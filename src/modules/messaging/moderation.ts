import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { MessagingError } from "./types";
import type { ModerationFlagReason, UserRole } from "@/lib/db/types";

/**
 * The Admin review queue for contact-info flags.
 *
 * A flag is raised automatically. Confirming one is a human decision, because
 * the scanner has false positives by design — "0803 456 7890" and "we need 803
 * chairs, 456 plates, 7890 napkins" are the same digits to a regular expression.
 *
 * Confirming increments the subject's `confirmed_solicitation_count`. It does
 * NOT create a strike.: "there is no fixed strike count that
 * triggers automatic removal — permanent removal is an Admin judgment call."
 * The strike itself is raised from Provider Management, which is a later phase.
 */

export interface ModerationFlagRow {
  id: string;
  messageId: string | null;
  conversationId: string | null;
  subjectId: string;
  reason: ModerationFlagReason;
  excerpt: string | null;
  status: "pending" | "confirmed" | "dismissed";
  createdAt: string;
}

function assertAdmin(actor: { role: UserRole }) {
  if (actor.role !== "admin") {
    throw new MessagingError("Only an admin may review moderation flags");
  }
}

export async function listPendingFlags(actor: { role: UserRole }): Promise<ModerationFlagRow[]> {
  assertAdmin(actor);

  const db = createAdminClient();
  const { data, error } = await db
    .from("moderation_flags")
    .select("id, message_id, conversation_id, subject_id, reason, excerpt, status, created_at")
    .eq("status", "pending")
    .order("created_at", { ascending: false });

  if (error) throw new MessagingError(`Could not load flags: ${error.message}`);

  return (data ?? []).map((r) => ({
    id: r.id,
    messageId: r.message_id,
    conversationId: r.conversation_id,
    subjectId: r.subject_id,
    reason: r.reason,
    excerpt: r.excerpt,
    status: r.status,
    createdAt: r.created_at,
  }));
}

export async function resolveFlag(
  flagId: string,
  decision: "confirmed" | "dismissed",
  actor: { id: string; role: UserRole },
): Promise<void> {
  assertAdmin(actor);

  const db = createAdminClient();
  const { error } = await db
    .from("moderation_flags")
    .update({
      status: decision,
      confirmed_at: decision === "confirmed" ? new Date().toISOString() : null,
      confirmed_by: actor.id,
      resolved_at: new Date().toISOString(),
      resolved_by: actor.id,
    })
    .eq("id", flagId);

  if (error) throw new MessagingError(`Could not resolve the flag: ${error.message}`);
}

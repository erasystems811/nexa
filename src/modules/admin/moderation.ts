import "server-only";

import { adminDb, audit, AdminError } from "./context";

/**
 * The contact-info flag queue and its consequences.
 *
 * Confirming a flag already increments the subject's solicitation count (a DB
 * trigger). This adds the step calls for: converting a confirmed
 * off-platform solicitation into a strike, "the same consequence structure as a
 * no-show" — a strike recorded against the offending account.
 */

export async function listFlags(status: "pending" | "confirmed" | "dismissed" = "pending") {
  const db = adminDb();
  const { data } = await db
    .from("moderation_flags")
    .select("id, reason, excerpt, status, subject_id, conversation_id, strike_id, created_at")
    .eq("status", status)
    .order("created_at", { ascending: false });
  return data ?? [];
}

export async function resolveFlag(
  actorId: string,
  flagId: string,
  decision: "confirmed" | "dismissed",
): Promise<void> {
  const db = adminDb();
  const { error } = await db
    .from("moderation_flags")
    .update({
      status: decision,
      confirmed_at: decision === "confirmed" ? new Date().toISOString() : null,
      confirmed_by: actorId,
      resolved_at: new Date().toISOString(),
      resolved_by: actorId,
    })
    .eq("id", flagId);
  if (error) throw new AdminError(error.message);
  await audit(actorId, `flag_${decision}`, "moderation_flag", flagId);
}

/**
 * Convert a confirmed flag into a strike on the relevant account. If the subject
 * is a provider, the strike lands on their provider record; a
 * customer's breach is recorded on the flag itself. The link back to the flag is
 * kept so the history is traceable.
 */
export async function convertFlagToStrike(actorId: string, flagId: string): Promise<void> {
  const db = adminDb();

  const { data: flag } = await db.from("moderation_flags").select("id, subject_id, status, strike_id").eq("id", flagId).single();
  if (!flag) throw new AdminError("No such flag");
  if (flag.status !== "confirmed") throw new AdminError("Confirm the flag before converting it to a strike");
  if (flag.strike_id) throw new AdminError("This flag is already a strike");

  const { data: provider } = await db.from("providers").select("id, strike_count").eq("user_id", flag.subject_id).maybeSingle();

  if (provider) {
    const { data: strike, error } = await db
      .from("provider_strikes")
      .insert({
        provider_id: provider.id,
        reason: "off_platform_solicitation",
        notes: "Confirmed attempt to move off-platform (anti-poaching breach)",
        issued_by: actorId,
      })
      .select("id")
      .single();
    if (error || !strike) throw new AdminError(error?.message ?? "Could not record the strike");

    await db.from("providers").update({ strike_count: (provider.strike_count ?? 0) + 1 }).eq("id", provider.id);
    await db.from("moderation_flags").update({ strike_id: strike.id, resulted_in_strike: true }).eq("id", flagId);
  } else {
    // The subject is a customer — the breach is logged on the flag itself.
    await db.from("moderation_flags").update({ resulted_in_strike: true }).eq("id", flagId);
  }

  await audit(actorId, "flag_to_strike", "moderation_flag", flagId, null, { subjectId: flag.subject_id });
}

import "server-only";

import { adminDb, audit, AdminError } from "./context";

/**
 * The general "contact Nexa" queue - a website form and the WhatsApp bot's
 * "help" keyword both write here, so a request is handled the same way no
 * matter which door it came through.
 */

export async function listSupportRequests(status?: "open" | "in_progress" | "resolved") {
  const db = adminDb();
  let q = db
    .from("support_requests")
    .select(
      "id, channel, name, contact, message, status, assigned_to, created_at, resolved_at, profiles!support_requests_assigned_to_fkey ( full_name )",
    )
    .order("created_at", { ascending: false });
  q = status ? q.eq("status", status) : q.in("status", ["open", "in_progress"]);
  const { data } = await q;
  return data ?? [];
}

export async function assignSupportRequest(
  actorId: string,
  requestId: string,
  assigneeId: string,
): Promise<void> {
  const db = adminDb();
  const { error } = await db
    .from("support_requests")
    .update({ assigned_to: assigneeId, status: "in_progress" })
    .eq("id", requestId);
  if (error) throw new AdminError(error.message);
  await audit(actorId, "support_request_assigned", "support_request", requestId, null, { assigneeId });
}

export async function resolveSupportRequest(actorId: string, requestId: string): Promise<void> {
  const db = adminDb();
  const { error } = await db
    .from("support_requests")
    .update({ status: "resolved", resolved_at: new Date().toISOString() })
    .eq("id", requestId);
  if (error) throw new AdminError(error.message);
  await audit(actorId, "support_request_resolved", "support_request", requestId, null, null);
}

/** The WhatsApp numbers that get pinged the moment a new request comes in. */
export async function listNotificationNumbers() {
  const db = adminDb();
  const { data } = await db
    .from("support_notification_numbers")
    .select("id, phone, label, created_at")
    .order("created_at");
  return data ?? [];
}

export async function addNotificationNumber(
  actorId: string,
  phone: string,
  label?: string,
): Promise<void> {
  const db = adminDb();
  const { error } = await db.from("support_notification_numbers").insert({ phone, label: label ?? null });
  if (error) throw new AdminError(error.message);
  await audit(actorId, "support_number_added", "support_notification_number", null, null, { phone });
}

export async function removeNotificationNumber(actorId: string, id: string): Promise<void> {
  const db = adminDb();
  const { error } = await db.from("support_notification_numbers").delete().eq("id", id);
  if (error) throw new AdminError(error.message);
  await audit(actorId, "support_number_removed", "support_notification_number", id, null, null);
}

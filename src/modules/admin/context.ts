import "server-only";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export class AdminError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AdminError";
  }
}

/**
 * The Admin Console runs on the service-role client — after the caller's admin
 * role is checked. Admins legitimately reach across every table and move money,
 * which RLS-scoped reads would only partly allow; the role check in the server
 * action (requireRole("admin")) is the gate, and the service role is what runs
 * once past it. This mirrors how the payments module is trusted after its own
 * authorisation.
 *
 * The read-side client is the admin's own session (admin_all RLS covers reads),
 * so a mis-scoped query fails closed rather than leaking on the service role.
 */
export function adminDb() {
  return createAdminClient();
}

export async function readDb() {
  return createClient();
}

/**
 * Every state-changing admin action leaves a row here — Section 12 admins
 * intervene on payments, statuses, and assignments, and each intervention needs
 * a name attached to it.
 */
export async function audit(
  actorId: string,
  action: string,
  entityType: string,
  entityId: string | null,
  before?: unknown,
  after?: unknown,
): Promise<void> {
  await adminDb()
    .from("audit_log")
    .insert({
      actor_id: actorId,
      action,
      entity_type: entityType,
      entity_id: entityId,
      before: (before ?? null) as never,
      after: (after ?? null) as never,
    });
}

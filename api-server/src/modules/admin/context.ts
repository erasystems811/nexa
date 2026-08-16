import { createAdminClient } from "../../supabase.js";

export class AdminError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AdminError";
  }
}

/**
 * The Admin Console runs on the service-role client — after the caller's admin
 * role is checked. Admins legitimately reach across every table and move money,
 * which RLS-scoped reads would only partly allow; the permission check in the
 * route (requirePermission(...)) is the gate, and the service role is what runs
 * once past it. This mirrors how the payments module is trusted after its own
 * authorisation.
 */
export function adminDb() {
  return createAdminClient();
}

/**
 * Every state-changing admin action leaves a row here — admins
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

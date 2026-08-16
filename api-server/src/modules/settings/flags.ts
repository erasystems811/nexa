import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, FeatureFlag, UserRole } from "@nexa/db-types/src/types";
import { createAdminClient } from "../../supabase.js";

/**
 * Feature flags. Ported from apps/customer's modules/settings/flags.ts —
 * same logic, but every function now takes the caller's request-scoped
 * Supabase client as a parameter instead of reaching for an implicit
 * per-request one (there's no Next.js request context here to hang it off).
 *
 * "Architecture and exposure are different decisions." Event Project and
 * Reliability Score can exist before they are publicly exposed; these rows
 * decide who can see them. Turning a feature on is an UPDATE, never a
 * migration and never a redeploy.
 */

export const FLAGS = {
  contactInfoFlagging: "contact_info_flagging",
  negotiablePricing: "negotiable_pricing",
  planMyEvent: "plan_my_event",
  publicReliabilityScore: "public_reliability_score",
  referrals: "referrals",
  whatsappMediatedChat: "whatsapp_mediated_chat",
} as const;

export type FlagKey = (typeof FLAGS)[keyof typeof FLAGS];

export async function getFlags(supabase: SupabaseClient<Database>): Promise<FeatureFlag[]> {
  const { data } = await supabase.from("feature_flags").select("*").order("key");
  return data ?? [];
}

/** An unknown or missing flag is OFF. Fail closed: a typo must hide a feature, never reveal one. */
export async function isEnabled(
  supabase: SupabaseClient<Database>,
  key: FlagKey,
  role?: UserRole,
): Promise<boolean> {
  const flag = (await getFlags(supabase)).find((f) => f.key === key);
  if (!flag || !flag.enabled) return false;
  if (!flag.enabled_for_roles) return true;
  return role ? flag.enabled_for_roles.includes(role) : false;
}

/** Admin-only write. Service-role, with its own re-check — see modules/admin's equivalent note. */
export async function setFlag(
  key: FlagKey,
  enabled: boolean,
  actor: { id: string; role: UserRole },
): Promise<void> {
  if (actor.role !== "admin") {
    throw new Error("Only an admin may change a feature flag");
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("feature_flags")
    .update({ enabled, updated_by: actor.id })
    .eq("key", key);

  if (error) throw new Error(`Could not update flag ${key}: ${error.message}`);
}

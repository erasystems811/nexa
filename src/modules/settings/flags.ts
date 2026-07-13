import "server-only";

import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { FeatureFlag, UserRole } from "@/lib/db/types";

/**
 * Feature flags.: "Architecture and exposure are different
 * decisions." Event Project and Reliability Score can exist before they are
 * publicly exposed; these rows decide who can see them.
 *
 * Turning a feature on is an UPDATE. It is never a migration and never a redeploy.
 */

/**
 * Flags the app knows by name. Adding one here does not create it - the row does,
 * so this list must match the rows exactly: a name with no row is permanently OFF
 * and silently hides whatever it guards.
 */
export const FLAGS = {
  contactInfoFlagging: "contact_info_flagging",
  coupons: "coupons",
  negotiablePricing: "negotiable_pricing",
  planMyEvent: "plan_my_event",
  publicReliabilityScore: "public_reliability_score",
  referrals: "referrals",
  whatsappMediatedChat: "whatsapp_mediated_chat",
} as const;

export type FlagKey = (typeof FLAGS)[keyof typeof FLAGS];

/** Deduped per request by React's cache, so a page may ask freely. */
export const getFlags = cache(async (): Promise<FeatureFlag[]> => {
  const supabase = await createClient();
  const { data } = await supabase.from("feature_flags").select("*").order("key");
  return data ?? [];
});

/**
 * An unknown or missing flag is OFF. Fail closed: a typo must hide a feature,
 * never reveal one.
 */
export async function isEnabled(key: FlagKey, role?: UserRole): Promise<boolean> {
  const flag = (await getFlags()).find((f) => f.key === key);
  if (!flag || !flag.enabled) return false;
  if (!flag.enabled_for_roles) return true;
  return role ? flag.enabled_for_roles.includes(role) : false;
}

/**
 * Admin-only write. Goes through the service-role client because RLS on
 * feature_flags admits only `is_admin`, and the caller has already been
 * checked by the Admin Console layout - but see the explicit re-check below:
 * a service-role write with no authorisation check of its own is a hole.
 */
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

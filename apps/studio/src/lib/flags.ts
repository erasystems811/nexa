import type { FeatureFlag, UserRole } from "@nexa/db-types/src/types";
import { apiGet } from "./api";

/**
 * Mirrors api-server's modules/settings/flags.ts isEnabled() — an unknown or
 * missing flag is OFF. This app has no request-scoped Supabase client to read
 * feature_flags directly, so it goes through the public GET /settings/flags
 * endpoint instead.
 */
export async function isFlagEnabled(key: string, role?: UserRole): Promise<boolean> {
  const flags = await apiGet<FeatureFlag[]>("/settings/flags");
  const flag = flags.find((f) => f.key === key);
  if (!flag || !flag.enabled) return false;
  if (!flag.enabled_for_roles) return true;
  return role ? flag.enabled_for_roles.includes(role) : false;
}

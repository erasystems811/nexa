import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, PlatformSetting, UserRole } from "@nexa/db-types/src/types";
import { createAdminClient } from "../../supabase.js";

/**
 * Platform settings — ported from apps/customer's modules/settings/service.ts.
 * Admin Console values, editable at any time without a code deployment.
 *
 * 0030 deleted every percentage: there is no commission, no deposit range, no
 * stage-1 release share, and no late penalty. Nexa holds the whole amount and
 * pays the vendor once the job is done, so nothing here computes anyone's cut.
 */

export const SETTINGS = {
  commissionPercent: "commission_percent",
  providerProbationBookings: "provider_probation_bookings",
  cancellationFreeWindowHours: "cancellation_free_window_hours",
  subscriptionFeeKobo: "subscription_fee_kobo",
  subscriptionGraceDays: "subscription_grace_days",
} as const;

export type SettingKey = (typeof SETTINGS)[keyof typeof SETTINGS];

const FALLBACKS: Record<SettingKey, number> = {
  commission_percent: 0,
  provider_probation_bookings: 3,
  cancellation_free_window_hours: 0,
  subscription_fee_kobo: 500_000,
  subscription_grace_days: 0,
};

export async function getSettings(supabase: SupabaseClient<Database>): Promise<PlatformSetting[]> {
  const { data } = await supabase.from("platform_settings").select("*").order("key");
  return data ?? [];
}

export async function getNumericSetting(supabase: SupabaseClient<Database>, key: SettingKey): Promise<number> {
  const setting = (await getSettings(supabase)).find((s) => s.key === key);
  const value = Number(setting?.value);
  return Number.isFinite(value) ? value : FALLBACKS[key];
}

export async function updateSetting(
  supabase: SupabaseClient<Database>,
  key: SettingKey,
  value: number,
  actor: { id: string; role: UserRole },
): Promise<void> {
  if (actor.role !== "admin") {
    throw new Error("Only an admin may change a platform setting");
  }

  const setting = (await getSettings(supabase)).find((s) => s.key === key);
  if (!setting) throw new Error(`Unknown setting: ${key}`);
  if (setting.min_value !== null && value < setting.min_value) {
    throw new Error(`${setting.label} must be at least ${setting.min_value}`);
  }
  if (setting.max_value !== null && value > setting.max_value) {
    throw new Error(`${setting.label} must be at most ${setting.max_value}`);
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("platform_settings")
    .update({ value, updated_by: actor.id })
    .eq("key", key);

  if (error) throw new Error(`Could not update ${key}: ${error.message}`);
}

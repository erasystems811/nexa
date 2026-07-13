import "server-only";

import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { PlatformSetting, UserRole } from "@/lib/db/types";

/**
 * Platform settings.re explicit that commission, the
 * stage-1 release percentage, and the vendor subscription fee are Admin Console
 * values "editable at any time without a code deployment".
 *
 * So there are no constants for them in this file. The defaults below exist
 * only to keep arithmetic total if a row is somehow missing; the row is the
 * source of truth.
 */

export const SETTINGS = {
  commissionPercent: "commission_percent",
  stage1ReleasePercent: "stage_1_release_percent",
  depositPercentMin: "deposit_percent_min",
  depositPercentMax: "deposit_percent_max",
  latePenaltyPercentPer30Min: "late_penalty_percent_per_30min",
  penaltyCustomerSharePercent: "penalty_customer_share_percent",
  payoutScheduleDays: "payout_schedule_days",
  providerProbationBookings: "provider_probation_bookings",
  cancellationFreeWindowHours: "cancellation_free_window_hours",
  subscriptionFeeKobo: "subscription_fee_kobo",
  subscriptionGraceDays: "subscription_grace_days",
} as const;

export type SettingKey = (typeof SETTINGS)[keyof typeof SETTINGS];

const FALLBACKS: Record<SettingKey, number> = {
  commission_percent: 10,
  stage_1_release_percent: 50,
  deposit_percent_min: 10,
  deposit_percent_max: 70,
  late_penalty_percent_per_30min: 1,
  penalty_customer_share_percent: 30,
  payout_schedule_days: 7,
  provider_probation_bookings: 3,
  cancellation_free_window_hours: 0,
  subscription_fee_kobo: 500_000,
  subscription_grace_days: 0,
};

export const getSettings = cache(async (): Promise<PlatformSetting[]> => {
  const supabase = await createClient();
  const { data } = await supabase.from("platform_settings").select("*").order("key");
  return data ?? [];
});

export async function getNumericSetting(key: SettingKey): Promise<number> {
  const setting = (await getSettings()).find((s) => s.key === key);
  const value = Number(setting?.value);
  return Number.isFinite(value) ? value : FALLBACKS[key];
}

export async function updateSetting(
  key: SettingKey,
  value: number,
  actor: { id: string; role: UserRole },
): Promise<void> {
  if (actor.role !== "admin") {
    throw new Error("Only an admin may change a platform setting");
  }

  // Bounds are also enforced by the enforce_setting_bounds trigger. Checking
  // here too turns a 500 into a message the admin can act on.
  const setting = (await getSettings()).find((s) => s.key === key);
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

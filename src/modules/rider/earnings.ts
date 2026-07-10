import "server-only";

import { createClient } from "@/lib/supabase/server";
import { RiderError } from "./context";

/**
 * Earnings and reliability. PRD Section 15.
 *
 * Balances are read-only to the rider (the payments service writes them,
 * guard_wallet_balance_write enforces it). Only the payout account is theirs.
 */
export async function getEarnings(riderId: string) {
  const supabase = await createClient();

  const [{ data: wallet }, { data: reliability }, { data: payouts }, { data: ledger }] =
    await Promise.all([
      supabase
        .from("rider_wallets")
        .select("pending_kobo, available_kobo, withdrawn_kobo, bank_code, bank_account_number, bank_account_name")
        .eq("rider_id", riderId)
        .maybeSingle(),
      supabase
        .from("rider_reliability")
        .select("on_time_rate, completed_deliveries")
        .eq("rider_id", riderId)
        .maybeSingle(),
      supabase
        .from("payouts")
        .select("id, amount_kobo, status, paid_at, created_at")
        .eq("rider_id", riderId)
        .order("created_at", { ascending: false }),
      supabase
        .from("payment_ledger_entries")
        .select("id, amount_kobo, stage, note, created_at")
        .eq("rider_id", riderId)
        .order("created_at", { ascending: false })
        .limit(50),
    ]);

  return {
    wallet: wallet ?? { pending_kobo: 0, available_kobo: 0, withdrawn_kobo: 0, bank_code: null, bank_account_number: null, bank_account_name: null },
    reliability: reliability ?? { on_time_rate: 0, completed_deliveries: 0 },
    payouts: payouts ?? [],
    ledger: ledger ?? [],
  };
}

export async function updateRiderBank(
  riderId: string,
  details: { bank_code: string; bank_account_number: string; bank_account_name: string },
): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("rider_wallets")
    .update(details)
    .eq("rider_id", riderId);
  if (error) throw new RiderError(error.message);
}

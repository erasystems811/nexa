import "server-only";

import { createClient } from "@/lib/supabase/server";
import { ProviderError } from "./context";

/**
 * Wallet and payouts.: balance, pending earnings, completed
 * earnings, withdrawal history.
 *
 * The balances are read-only to the provider — the payments service writes them,
 * and guard_wallet_balance_write rejects any attempt by the provider to
 * change them. Only the bank details are theirs to set.
 */

export async function getWallet(providerId: string) {
  const supabase = await createClient();

  const [{ data: wallet }, { data: payouts }, { data: ledger }] = await Promise.all([
    supabase
      .from("provider_wallets")
      .select("pending_kobo, available_kobo, withdrawn_kobo, bank_code, bank_account_number, bank_account_name")
      .eq("provider_id", providerId)
      .maybeSingle(),
    supabase
      .from("payouts")
      .select("id, amount_kobo, status, scheduled_for, paid_at, created_at")
      .eq("provider_id", providerId)
      .order("created_at", { ascending: false }),
    supabase
      .from("payment_ledger_entries")
      .select("id, kind, amount_kobo, stage, note, created_at")
      .eq("provider_id", providerId)
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  return {
    wallet: wallet ?? {
      pending_kobo: 0,
      available_kobo: 0,
      withdrawn_kobo: 0,
      bank_code: null,
      bank_account_number: null,
      bank_account_name: null,
    },
    payouts: payouts ?? [],
    ledger: ledger ?? [],
  };
}

export async function updateBankDetails(
  providerId: string,
  details: { bank_code: string; bank_account_number: string; bank_account_name: string },
): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("provider_wallets")
    .update(details)
    .eq("provider_id", providerId);
  if (error) throw new ProviderError(error.message);
}

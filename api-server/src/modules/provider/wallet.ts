import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@nexa/db-types/src/types";
import { ProviderError } from "./context.js";

/** Wallet and payouts. Ported from apps/customer's modules/provider/wallet.ts — unchanged. Balances are read-only here; the payments service writes them. */

export async function getWallet(supabase: SupabaseClient<Database>, providerId: string) {
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
  supabase: SupabaseClient<Database>,
  providerId: string,
  details: { bank_code: string; bank_account_number: string; bank_account_name: string },
): Promise<void> {
  const { error } = await supabase.from("provider_wallets").update(details).eq("provider_id", providerId);
  if (error) throw new ProviderError(error.message);
}

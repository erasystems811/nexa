import { getPaymentGateway, GatewayError, type Bank } from "./gateway/index.js";

/**
 * The banks a vendor can be paid into. Ported from apps/customer's
 * modules/payments/banks.ts — the request-scoped `cache()` wrapper is
 * dropped (no per-request memoization layer here; each call is cheap enough
 * to just make).
 */

export type { Bank } from "./gateway/index.js";

export async function listBanks(): Promise<Bank[]> {
  try {
    return await getPaymentGateway().listBanks();
  } catch (e) {
    // A processor having a bad morning must not take the wallet page down.
    if (e instanceof GatewayError) return [];
    throw e;
  }
}

/** The vendor's bank, by name. Returns the raw code when it isn't in the list — still worth showing, since it's what will be paid. */
export async function bankName(code: string | null): Promise<string | null> {
  if (!code) return null;
  const banks = await listBanks();
  return banks.find((b) => b.code === code)?.name ?? code;
}

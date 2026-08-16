import "server-only";

import { cache } from "react";
import { getPaymentGateway, GatewayError, type Bank } from "./gateway";

/**
 * The banks a vendor can be paid into.
 *
 * Business Studio used to show a vendor a box labelled "Bank code" and expect
 * them to type 058. Nobody knows that number. They type "GTBank", or guess, and
 * the payout fails later in a way that looks like Nexa refusing to pay them —
 * the worst possible bug, because the vendor cannot see the cause and Nexa
 * cannot see the complaint.
 *
 * So the vendor picks a name and Nexa keeps the code, and the codes come from
 * whichever processor will have to honour them.
 */

export type { Bank } from "./gateway";

/** `cache` keeps this to one call per request however many components ask. */
export const listBanks = cache(async (): Promise<Bank[]> => {
  try {
    return await getPaymentGateway().listBanks();
  } catch (e) {
    // A processor having a bad morning must not take the wallet page down. The
    // form falls back to letting them type the code, which is exactly as good
    // as what they had before — and no worse.
    if (e instanceof GatewayError) return [];
    throw e;
  }
});

/**
 * The vendor's bank, by name, for showing back to them and to Admin.
 *
 * Returns the raw code when the list cannot be fetched or the code is not in it
 * — an unknown code is still worth showing, because it is what will be paid.
 */
export async function bankName(code: string | null): Promise<string | null> {
  if (!code) return null;
  const banks = await listBanks();
  return banks.find((b) => b.code === code)?.name ?? code;
}

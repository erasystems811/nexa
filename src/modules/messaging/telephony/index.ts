import "server-only";

import { serverEnv } from "@/lib/env";
import { AfricasTalkingTelephony } from "./africastalking";
import { MockTelephony } from "./mock";
import type { TelephonyProvider } from "./types";

let instance: TelephonyProvider | null = null;

/**
 * Resolves the telephony provider from TELEPHONY_PROVIDER. Swapping providers
 * is one adapter file and one case here — no calling, chat, or booking code
 * changes, and no column in the schema names a vendor.
 */
export function getTelephonyProvider(): TelephonyProvider {
  if (instance) return instance;

  switch (serverEnv().TELEPHONY_PROVIDER) {
    case "africastalking":
      instance = new AfricasTalkingTelephony();
      break;
    case "mock":
      instance = new MockTelephony();
      break;
  }

  return instance;
}

export * from "./types";

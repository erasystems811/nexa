import "server-only";

import { serverEnv } from "@/lib/env";
import { FlutterwaveGateway } from "./flutterwave";
import { MockGateway } from "./mock";
import type { PaymentGateway } from "./types";

let instance: PaymentGateway | null = null;

/**
 * Resolves the gateway from PAYMENT_GATEWAY. Swapping processors is this one
 * switch plus a new adapter file — no booking, escrow, or payout code changes.
 */
export function getPaymentGateway(): PaymentGateway {
  if (instance) return instance;

  switch (serverEnv().PAYMENT_GATEWAY) {
    case "flutterwave":
      instance = new FlutterwaveGateway();
      break;
    case "mock":
      instance = new MockGateway();
      break;
  }

  return instance;
}

export * from "./types";

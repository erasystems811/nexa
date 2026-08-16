import { env } from "../../../env.js";
import { FlutterwaveGateway } from "./flutterwave.js";
import { MockGateway } from "./mock.js";
import type { PaymentGateway } from "./types.js";

let instance: PaymentGateway | null = null;

/** Resolves the gateway from PAYMENT_GATEWAY. Ported from apps/customer's modules/payments/gateway/index.ts. */
export function getPaymentGateway(): PaymentGateway {
  if (instance) return instance;

  switch (env.PAYMENT_GATEWAY) {
    case "flutterwave":
      instance = new FlutterwaveGateway();
      break;
    case "mock":
    default:
      instance = new MockGateway();
      break;
  }

  return instance;
}

export * from "./types.js";

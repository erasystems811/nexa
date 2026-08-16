import { randomUUID } from "node:crypto";
import type {
  Bank,
  HoldFundsRequest,
  HoldFundsResult,
  PaymentGateway,
  RefundRequest,
  RefundResult,
  ReleaseFundsRequest,
  ReleaseFundsResult,
  WebhookEvent,
} from "./types.js";

/**
 * Stateless mock gateway for development. Ported from apps/customer's
 * modules/payments/gateway/mock.ts — unchanged. Default until Flutterwave's
 * escrow product is approved for Nexa's account.
 */
export class MockGateway implements PaymentGateway {
  readonly name = "mock";

  async listBanks(): Promise<Bank[]> {
    return [
      { code: "044", name: "Access Bank" },
      { code: "023", name: "Citibank Nigeria" },
      { code: "050", name: "Ecobank Nigeria" },
      { code: "011", name: "First Bank of Nigeria" },
      { code: "058", name: "Guaranty Trust Bank" },
      { code: "030", name: "Heritage Bank" },
      { code: "301", name: "Jaiz Bank" },
      { code: "082", name: "Keystone Bank" },
      { code: "076", name: "Polaris Bank" },
      { code: "221", name: "Stanbic IBTC Bank" },
      { code: "232", name: "Sterling Bank" },
      { code: "032", name: "Union Bank of Nigeria" },
      { code: "033", name: "United Bank for Africa" },
      { code: "215", name: "Unity Bank" },
      { code: "035", name: "Wema Bank" },
      { code: "057", name: "Zenith Bank" },
      { code: "090267", name: "Kuda" },
      { code: "090405", name: "Moniepoint Microfinance Bank" },
      { code: "100004", name: "Opay" },
    ].sort((a, b) => a.name.localeCompare(b.name));
  }

  async holdFunds(_request: HoldFundsRequest): Promise<HoldFundsResult> {
    return { gatewayReference: `mock_${randomUUID()}`, status: "held" };
  }

  async releaseFunds(request: ReleaseFundsRequest): Promise<ReleaseFundsResult> {
    return { gatewayReference: request.gatewayReference, status: "released" };
  }

  async refund(request: RefundRequest): Promise<RefundResult> {
    return { gatewayReference: request.gatewayReference, status: "refunded" };
  }

  parseWebhook(rawBody: string): WebhookEvent {
    const payload = JSON.parse(rawBody) as Record<string, unknown>;
    return {
      id: String(payload.id ?? randomUUID()),
      type: String(payload.type ?? "unknown"),
      gatewayReference: (payload.gatewayReference as string) ?? null,
      payload,
    };
  }
}

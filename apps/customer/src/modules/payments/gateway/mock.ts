import "server-only";

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
} from "./types";

/**
 * Stateless mock gateway for development, tests, and the pre-Flutterwave demo.
 *
 * This is the default (PAYMENT_GATEWAY=mock) and stays the default until
 * Flutterwave confirms their escrow product is approved for Nexa's account —
 *lists that as the one open founder decision, and until it
 * closes, no real money should be routed anywhere.
 *
 * Deliberately holds NO in-memory state: every hold succeeds and every release
 * and refund is accepted. Balance integrity is not the gateway's job here — the
 * payments service enforces it against the database (held_kobo vs released_kobo),
 * which is the real source of truth. An in-memory ledger would also not survive a
 * serverless deployment, where each request may run in a fresh instance.
 */
export class MockGateway implements PaymentGateway {
  readonly name = "mock";

  /**
   * Enough real banks to fill a dropdown in development, with their real codes.
   * The three at the bottom are the ones a Nigerian vendor is most likely to
   * actually bank with, and the easiest to forget when picking a test fixture.
   */
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

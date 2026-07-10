import "server-only";

import { randomUUID } from "node:crypto";
import type {
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
 * PRD Section 20 lists that as the one open founder decision, and until it
 * closes, no real money should be routed anywhere.
 *
 * Deliberately holds NO in-memory state: every hold succeeds and every release
 * and refund is accepted. Balance integrity is not the gateway's job here — the
 * payments service enforces it against the database (held_kobo, released_kobo,
 * the delivery-fee budget, the stage-released timestamps), which is the real
 * source of truth. An in-memory ledger would also not survive a serverless
 * deployment, where each request may run in a fresh instance.
 */
export class MockGateway implements PaymentGateway {
  readonly name = "mock";

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

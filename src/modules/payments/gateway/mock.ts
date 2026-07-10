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
 * In-memory gateway for development and tests.
 *
 * This is the default (PAYMENT_GATEWAY=mock) and stays the default until
 * Flutterwave confirms their escrow product is approved for Nexa's account —
 * PRD Section 20 lists that as the one open founder decision, and until it
 * closes, no real money should be routed anywhere.
 */
export class MockGateway implements PaymentGateway {
  readonly name = "mock";

  private readonly held = new Map<string, number>();
  private readonly seenIdempotencyKeys = new Set<string>();

  async holdFunds(request: HoldFundsRequest): Promise<HoldFundsResult> {
    const gatewayReference = `mock_${randomUUID()}`;
    const total =
      request.amountKobo + (request.cautionFeeKobo ?? 0) + (request.deliveryFeeKobo ?? 0);
    this.held.set(gatewayReference, total);
    return { gatewayReference, status: "held" };
  }

  async releaseFunds(request: ReleaseFundsRequest): Promise<ReleaseFundsResult> {
    // Mirrors the real contract: a repeated key is a no-op, not a second payout.
    if (this.seenIdempotencyKeys.has(request.idempotencyKey)) {
      return { gatewayReference: request.gatewayReference, status: "released" };
    }
    this.seenIdempotencyKeys.add(request.idempotencyKey);

    const balance = this.held.get(request.gatewayReference) ?? 0;
    if (request.amountKobo > balance) {
      throw new Error(
        `Mock gateway: cannot release ${request.amountKobo} from a hold of ${balance}`,
      );
    }
    this.held.set(request.gatewayReference, balance - request.amountKobo);
    return { gatewayReference: request.gatewayReference, status: "released" };
  }

  async refund(request: RefundRequest): Promise<RefundResult> {
    if (this.seenIdempotencyKeys.has(request.idempotencyKey)) {
      return { gatewayReference: request.gatewayReference, status: "refunded" };
    }
    this.seenIdempotencyKeys.add(request.idempotencyKey);

    const balance = this.held.get(request.gatewayReference) ?? 0;
    this.held.set(request.gatewayReference, Math.max(0, balance - request.amountKobo));
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

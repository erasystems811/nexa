import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import { serverEnv } from "@/lib/env";
import {
  GatewayError,
  type HoldFundsRequest,
  type HoldFundsResult,
  type PaymentGateway,
  type RefundRequest,
  type RefundResult,
  type ReleaseFundsRequest,
  type ReleaseFundsResult,
  type WebhookEvent,
} from "./types";

/**
 * Flutterwave adapter.
 *
 * Deliberately unimplemented. PRD Section 20, "Still Open":
 *
 *   "Confirming with Flutterwave that their escrow product is approved for
 *    Nexa's account (not just documented) and what Nigerian regulatory
 *    requirements apply to holding customer funds this way."
 *
 * Writing the API calls before that answer arrives would mean guessing at an
 * endpoint shape and a settlement model that may not be the one Nexa is granted.
 * The methods throw rather than half-work, so nothing can silently route money
 * through an unconfirmed integration.
 *
 * What is real here is `parseWebhook`: signature verification does not depend on
 * which product is approved, and getting it wrong is how a marketplace pays out
 * on a forged callback.
 */
export class FlutterwaveGateway implements PaymentGateway {
  readonly name = "flutterwave";

  private notReady(operation: string): never {
    throw new GatewayError(
      `Flutterwave ${operation}() is not implemented: the escrow product is not yet ` +
        `confirmed for this account (PRD Section 20). Run with PAYMENT_GATEWAY=mock.`,
      this.name,
    );
  }

  async holdFunds(_request: HoldFundsRequest): Promise<HoldFundsResult> {
    this.notReady("holdFunds");
  }

  async releaseFunds(_request: ReleaseFundsRequest): Promise<ReleaseFundsResult> {
    this.notReady("releaseFunds");
  }

  async refund(_request: RefundRequest): Promise<RefundResult> {
    this.notReady("refund");
  }

  parseWebhook(rawBody: string, signature: string | null): WebhookEvent {
    const secret = serverEnv().FLUTTERWAVE_WEBHOOK_SECRET;
    if (!secret) {
      throw new GatewayError("FLUTTERWAVE_WEBHOOK_SECRET is not set", this.name);
    }
    if (!signature) {
      throw new GatewayError("Webhook arrived without a signature", this.name);
    }

    const expected = createHmac("sha256", secret).update(rawBody).digest();
    const received = Buffer.from(signature, "hex");

    // Length must match before timingSafeEqual, which throws on a mismatch —
    // and the comparison itself must not short-circuit on the first wrong byte.
    if (
      received.length !== expected.length ||
      !timingSafeEqual(received, expected)
    ) {
      throw new GatewayError("Webhook signature does not verify", this.name);
    }

    const payload = JSON.parse(rawBody) as Record<string, unknown>;
    const data = (payload.data ?? {}) as Record<string, unknown>;

    return {
      id: String(payload.id ?? data.id ?? ""),
      type: String(payload.event ?? "unknown"),
      gatewayReference: (data.flw_ref as string) ?? null,
      payload,
    };
  }
}

import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import { serverEnv } from "@/lib/env";
import {
  TelephonyError,
  type CreateMaskedSessionInput,
  type MaskedCallSession,
  type TelephonyEvent,
  type TelephonyProvider,
} from "./types";

/**
 * Africa's Talking adapter. Chosen as the reference provider because its voice
 * product covers Nigeria directly; Twilio retired its Proxy API, which is the
 * product this pattern would otherwise use.
 *
 * Deliberately unimplemented, for the same reason FlutterwaveGateway is: nobody
 * has an account yet, and a masked-calling integration written against a guessed
 * request shape and an unallocated pool of proxy numbers would be fiction that
 * compiles. Running with TELEPHONY_PROVIDER=mock is the honest default.
 *
 * What is real here is `parseWebhook`. Signature verification does not depend on
 * which numbers get allocated, and accepting an unsigned callback is how a
 * platform gets told a call completed when it never happened.
 */
export class AfricasTalkingTelephony implements TelephonyProvider {
  readonly name = "africastalking";

  private notReady(operation: string): never {
    throw new TelephonyError(
      `Africa's Talking ${operation}() is not implemented: no account, no proxy ` +
        `number pool. Run with TELEPHONY_PROVIDER=mock.`,
      this.name,
    );
  }

  async createMaskedSession(_input: CreateMaskedSessionInput): Promise<MaskedCallSession> {
    this.notReady("createMaskedSession");
  }

  async endSession(_sessionRef: string): Promise<void> {
    this.notReady("endSession");
  }

  parseWebhook(rawBody: string, signature: string | null): TelephonyEvent {
    const secret = serverEnv().TELEPHONY_WEBHOOK_SECRET;
    if (!secret) {
      throw new TelephonyError("TELEPHONY_WEBHOOK_SECRET is not set", this.name);
    }
    if (!signature) {
      throw new TelephonyError("Callback arrived without a signature", this.name);
    }

    const expected = createHmac("sha256", secret).update(rawBody).digest();
    const received = Buffer.from(signature, "hex");

    // Compare in constant time, and check length first — timingSafeEqual throws
    // on a length mismatch rather than returning false.
    if (received.length !== expected.length || !timingSafeEqual(received, expected)) {
      throw new TelephonyError("Callback signature does not verify", this.name);
    }

    const payload = JSON.parse(rawBody) as Record<string, unknown>;
    return {
      id: String(payload.sessionId ?? ""),
      type: mapStatus(String(payload.status ?? "")),
      sessionRef: (payload.sessionId as string) ?? null,
      durationSeconds: payload.durationInSeconds ? Number(payload.durationInSeconds) : null,
      payload,
    };
  }
}

function mapStatus(status: string): TelephonyEvent["type"] {
  switch (status.toLowerCase()) {
    case "ringing":
      return "ringing";
    case "answered":
    case "inprogress":
      return "answered";
    case "completed":
    case "success":
      return "completed";
    case "noanswer":
      return "no_answer";
    default:
      return "failed";
  }
}

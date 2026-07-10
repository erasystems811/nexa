/**
 * The telephony boundary. PRD Section 08:
 *
 *   "Calls are connected through the platform (a proxy/masked connection, the
 *    same pattern ride-hailing apps use) so neither side sees the other's real
 *    phone number."
 *
 * Nothing outside `modules/messaging` imports this file — eslint.config.mjs
 * enforces it, the same way the payment gateway is sealed inside
 * `modules/payments`.
 *
 * The contract has one rule above all others: a real subscriber number goes
 * *in* to createMaskedSession and never comes back *out*. Everything returned
 * here is safe to show a user.
 */

export interface CreateMaskedSessionInput {
  conversationId: string;
  /** Real number. Server-side only. Never returned, never logged. */
  customerPhone: string;
  /** Real number. Server-side only. Never returned, never logged. */
  providerPhone: string;
  ttlSeconds: number;
}

export interface MaskedCallSession {
  sessionRef: string;
  telephonyProvider: string;
  /** What the customer dials to reach the provider. A proxy number. */
  customerProxyNumber: string;
  /** What the provider dials to reach the customer. A proxy number. */
  providerProxyNumber: string;
  expiresAt: Date;
}

export type CallEventType =
  | "ringing"
  | "answered"
  | "completed"
  | "failed"
  | "no_answer";

export interface TelephonyEvent {
  id: string;
  type: CallEventType;
  sessionRef: string | null;
  durationSeconds: number | null;
  payload: unknown;
}

export interface TelephonyProvider {
  readonly name: string;

  /** Allocates a pair of proxy numbers that bridge these two real numbers. */
  createMaskedSession(input: CreateMaskedSessionInput): Promise<MaskedCallSession>;

  /** Releases the proxy numbers back to the pool. */
  endSession(sessionRef: string): Promise<void>;

  /** Verifies a callback's authenticity and normalises it. Throws if unauthentic. */
  parseWebhook(rawBody: string, signature: string | null): TelephonyEvent;
}

export class TelephonyError extends Error {
  constructor(
    message: string,
    readonly provider: string,
    readonly cause?: unknown,
  ) {
    super(message);
    this.name = "TelephonyError";
  }
}

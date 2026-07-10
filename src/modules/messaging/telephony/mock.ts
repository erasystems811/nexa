import "server-only";

import { createHash, randomUUID } from "node:crypto";
import type {
  CreateMaskedSessionInput,
  MaskedCallSession,
  TelephonyEvent,
  TelephonyProvider,
} from "./types";

/**
 * In-memory masked-calling provider for development and tests.
 *
 * Proxy numbers are drawn from +2348000000000–+2348000009999. That prefix
 * (0800) is Nigeria's toll-free range, not a mobile range, so a generated proxy
 * can never collide with a real subscriber's 070/080/081/090 mobile number.
 * The database rejects a proxy that matches a stored real number anyway
 * (reject_real_numbers_in_call_session, 0013), but relying on that would be
 * relying on a backstop.
 */
export class MockTelephony implements TelephonyProvider {
  readonly name = "mock";

  private readonly sessions = new Map<string, CreateMaskedSessionInput>();

  private proxyFor(seed: string): string {
    const digits = parseInt(createHash("sha256").update(seed).digest("hex").slice(0, 8), 16);
    return `+23480000${String(digits % 10000).padStart(4, "0")}`;
  }

  async createMaskedSession(input: CreateMaskedSessionInput): Promise<MaskedCallSession> {
    const sessionRef = `mockcall_${randomUUID()}`;
    this.sessions.set(sessionRef, input);

    return {
      sessionRef,
      telephonyProvider: this.name,
      customerProxyNumber: this.proxyFor(`${sessionRef}:customer`),
      providerProxyNumber: this.proxyFor(`${sessionRef}:provider`),
      expiresAt: new Date(Date.now() + input.ttlSeconds * 1000),
    };
  }

  async endSession(sessionRef: string): Promise<void> {
    this.sessions.delete(sessionRef);
  }

  parseWebhook(rawBody: string): TelephonyEvent {
    const payload = JSON.parse(rawBody) as Record<string, unknown>;
    return {
      id: String(payload.id ?? randomUUID()),
      type: (payload.type as TelephonyEvent["type"]) ?? "completed",
      sessionRef: (payload.sessionRef as string) ?? null,
      durationSeconds: (payload.durationSeconds as number) ?? null,
      payload,
    };
  }
}

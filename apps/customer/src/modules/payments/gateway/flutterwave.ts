import "server-only";

import { createHash, timingSafeEqual } from "node:crypto";
import { serverEnv } from "@/lib/env";
import {
  GatewayError,
  type Bank,
  type HoldFundsRequest,
  type HoldFundsResult,
  type Kobo,
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
 * Nexa does not buy an "escrow product" from anyone. Nexa *is* the escrow, and
 * Flutterwave is only the rails:
 *
 *   holdFunds     the customer pays a Flutterwave hosted checkout page whose
 *                 settlement account is Nexa's. The money sits in Nexa's own
 *                 balance. That, and nothing more elaborate, is the hold.
 *   releaseFunds  a Transfer out of that balance into the provider's bank
 *                 account, for whatever amount an admin released.
 *   refund        a refund of the original charge, back to where it came from.
 *
 * Hosted checkout only. The direct card-charge endpoint is the one call that
 * needs FLUTTERWAVE_ENCRYPTION_KEY, and Nexa deliberately does not hold card
 * data or that key — the customer types their card on Flutterwave's page.
 *
 * ---------------------------------------------------------------------------
 * What `gatewayReference` means here, because it changes once:
 *
 *   at hold time  →  the tx_ref, i.e. Nexa's own booking reference. The
 *                    /v3/payments call returns a checkout link and no id, so
 *                    there is nothing else it could be.
 *   after the charge.completed webhook  →  Flutterwave's numeric transaction
 *                    id, which the webhook route writes back onto the payment
 *                    row. Refunds are addressed by transaction id and by
 *                    nothing else, so a refund attempted before the webhook has
 *                    landed fails loudly rather than guessing.
 * ---------------------------------------------------------------------------
 */

const API_BASE = "https://api.flutterwave.com/v3";
const CURRENCY = "NGN";
const COUNTRY = "NG";
const TIMEOUT_MS = 20_000;

/** Every Flutterwave response is this envelope. `status` is the real verdict. */
interface Envelope<T> {
  status?: string;
  message?: string;
  data?: T;
}

interface PaymentLinkData {
  link?: string;
}

interface TransferData {
  id?: number | string;
  reference?: string;
  status?: string;
}

interface RefundData {
  id?: number | string;
  status?: string;
}

interface BankData {
  code?: string;
  name?: string;
}

export class FlutterwaveGateway implements PaymentGateway {
  readonly name = "flutterwave";

  // -------------------------------------------------------------------------
  // Banks
  // -------------------------------------------------------------------------

  /**
   * The banks Flutterwave will pay into, asked of Flutterwave itself.
   *
   * A hardcoded list would be wrong within a year — Nigerian banks merge, and
   * the ones vendors actually use (Moniepoint, Opay, Kuda) are newer than most
   * lists. Asking the processor that has to honour the code is the only way the
   * code is certainly right.
   *
   * Deduplicated by name: the raw list carries several hundred entries, and the
   * same bank appears more than once when it has more than one rail. The first
   * code wins, and the list comes back alphabetical because a vendor scrolling
   * for their bank is the entire point.
   */
  async listBanks(): Promise<Bank[]> {
    const data = await this.get<BankData[]>(`/banks/${COUNTRY}`);

    const byName = new Map<string, Bank>();
    for (const bank of data) {
      const name = bank.name?.trim();
      if (!name || !bank.code) continue;
      if (!byName.has(name.toUpperCase())) {
        byName.set(name.toUpperCase(), { code: bank.code, name });
      }
    }

    return [...byName.values()].sort((a, b) => a.name.localeCompare(b.name));
  }

  // -------------------------------------------------------------------------
  // Money in
  // -------------------------------------------------------------------------

  /**
   * Opens a hosted checkout for the whole of what the customer owes, which on a
   * service booking is the agreed price and nothing else: no delivery fee (a
   * transport vendor prices its own job into its listing) and no caution fee
   * (nothing is rented out and returned). One charge, one figure, and
   * `payments.held_kobo` is all of it.
   *
   * The result is `pending`, not `held`. Nothing is held until the customer has
   * actually paid the page, and only the webhook knows when that happened.
   */
  async holdFunds(request: HoldFundsRequest): Promise<HoldFundsResult> {
    const totalKobo = request.amountKobo;

    if (!Number.isFinite(totalKobo) || totalKobo <= 0) {
      throw new GatewayError(
        `Refusing to open a checkout for ${totalKobo} kobo on ${request.reference}`,
        this.name,
      );
    }

    const data = await this.call<PaymentLinkData>("/payments", {
      tx_ref: request.reference,
      amount: koboToNaira(totalKobo),
      currency: CURRENCY,
      redirect_url: request.redirectUrl,
      customer: {
        email: request.customer.email,
        name: request.customer.name,
        phonenumber: request.customer.phone,
      },
      customizations: {
        title: "Nexa",
        description: `Booking ${request.reference}`,
      },
      // Echoed back on the webhook. The kobo figure rides along so the webhook
      // can check that what was paid is what was asked for, without trusting a
      // float it re-derived from naira.
      meta: {
        ...request.metadata,
        reference: request.reference,
        customer_id: request.customer.id,
        amount_kobo: request.amountKobo,
        total_kobo: totalKobo,
      },
    });

    if (!data.link) {
      throw new GatewayError(
        `Flutterwave accepted the payment for ${request.reference} but returned no checkout link`,
        this.name,
      );
    }

    return {
      gatewayReference: request.reference,
      checkoutUrl: data.link,
      status: "pending",
    };
  }

  // -------------------------------------------------------------------------
  // Money out
  // -------------------------------------------------------------------------

  /**
   * Pays the admin's chosen amount to the provider's bank account out of Nexa's
   * Flutterwave balance. This is a Transfer, not a "release" of some
   * provider-held escrow — Flutterwave has no notion of which of Nexa's naira
   * belonged to which booking, and does not need one. The ledger does.
   *
   * `idempotencyKey` becomes the transfer's `reference`, which Flutterwave
   * enforces as unique per account. A double-clicked admin button is therefore
   * rejected by Flutterwave rather than paid twice, and that rejection is read
   * here as "already sent" instead of as a failure.
   */
  async releaseFunds(request: ReleaseFundsRequest): Promise<ReleaseFundsResult> {
    if (request.amountKobo <= 0) {
      throw new GatewayError(`Refusing to transfer ${request.amountKobo} kobo`, this.name);
    }

    const reference = transferReference(request.idempotencyKey);

    try {
      const data = await this.call<TransferData>("/transfers", {
        account_bank: request.beneficiary.bankCode,
        account_number: request.beneficiary.accountNumber,
        amount: koboToNaira(request.amountKobo),
        currency: CURRENCY,
        debit_currency: CURRENCY,
        reference,
        narration: narration(request),
        meta: {
          ...request.metadata,
          provider_id: request.beneficiary.id,
          source_reference: request.gatewayReference,
        },
      });

      return {
        gatewayReference: String(data.id ?? reference),
        // A transfer is queued, then settled by the bank. NEW / PENDING are the
        // normal answers here; SUCCESSFUL usually arrives on transfer.completed.
        status: String(data.status ?? "").toUpperCase() === "SUCCESSFUL" ? "released" : "pending",
      };
    } catch (error) {
      if (error instanceof GatewayError && isDuplicateReference(error)) {
        // Flutterwave already has this exact transfer. Saying so is the correct
        // answer to "send it", not an error — the caller asked for one payment
        // and there is exactly one.
        return { gatewayReference: reference, status: "pending" };
      }
      throw error;
    }
  }

  /**
   * Refunds the original charge. Addressed by Flutterwave's numeric transaction
   * id, which only exists once the customer has actually paid — so a refund
   * before the charge.completed webhook has landed is refused rather than sent
   * to a URL built out of a booking reference.
   */
  async refund(request: RefundRequest): Promise<RefundResult> {
    const transactionId = request.gatewayReference;

    if (!/^\d+$/.test(transactionId)) {
      throw new GatewayError(
        `Cannot refund against "${transactionId}": Flutterwave refunds are addressed by the ` +
          `numeric transaction id, which is written onto the payment row when the ` +
          `charge.completed webhook arrives. This charge has not completed.`,
        this.name,
      );
    }

    if (request.amountKobo <= 0) {
      throw new GatewayError(`Refusing to refund ${request.amountKobo} kobo`, this.name);
    }

    // Flutterwave's refund endpoint takes no idempotency key. `idempotencyKey` is
    // honoured one level up: the payments service derives it from the booking and
    // the amount, so the same cancellation cannot be refunded twice.
    const data = await this.call<RefundData>(`/transactions/${transactionId}/refund`, {
      amount: koboToNaira(request.amountKobo),
      comments: request.reason.slice(0, 255),
    });

    return {
      gatewayReference: String(data.id ?? transactionId),
      status: String(data.status ?? "").toLowerCase() === "completed" ? "refunded" : "pending",
    };
  }

  // -------------------------------------------------------------------------
  // Callbacks
  // -------------------------------------------------------------------------

  /**
   * Flutterwave does not sign its webhooks. It sends back, verbatim, the "secret
   * hash" you typed into the dashboard, in a `verif-hash` header. There is no
   * HMAC, no body digest, no timestamp — the header is a shared secret and the
   * only correct check is "does this string equal ours".
   *
   * (The previous implementation computed an HMAC-SHA256 of the body and
   * compared it to the header. That check can never pass against a real
   * Flutterwave callback, so every genuine event would have been rejected.)
   *
   * Compared through a SHA-256 of each side so that the comparison is
   * fixed-length and constant-time: timingSafeEqual throws on a length mismatch,
   * which would otherwise leak the secret's length to anyone who probed it.
   */
  parseWebhook(rawBody: string, signature: string | null): WebhookEvent {
    const secret = serverEnv().FLUTTERWAVE_WEBHOOK_SECRET;
    if (!secret) {
      throw new GatewayError("FLUTTERWAVE_WEBHOOK_SECRET is not set", this.name);
    }
    if (!signature) {
      throw new GatewayError("Webhook arrived without a verif-hash header", this.name);
    }
    if (!verifySecretHash(signature, secret)) {
      throw new GatewayError("Webhook verif-hash does not match", this.name);
    }

    let payload: Record<string, unknown>;
    try {
      payload = JSON.parse(rawBody) as Record<string, unknown>;
    } catch (cause) {
      throw new GatewayError("Webhook body is not JSON", this.name, cause);
    }

    const data = (payload.data ?? {}) as Record<string, unknown>;
    const type = String(payload.event ?? payload["event.type"] ?? "unknown");

    return {
      id: webhookEventId(type, payload, data),
      type,
      // The transaction id, because that is what a later refund must address.
      gatewayReference:
        data.id !== undefined && data.id !== null
          ? String(data.id)
          : ((data.flw_ref as string | undefined) ?? null),
      payload,
    };
  }

  // -------------------------------------------------------------------------
  // Transport
  // -------------------------------------------------------------------------

  private secretKey(): string {
    const key = serverEnv().FLUTTERWAVE_SECRET_KEY;
    if (!key) {
      throw new GatewayError(
        "FLUTTERWAVE_SECRET_KEY is not set. Run with PAYMENT_GATEWAY=mock, or set the key.",
        this.name,
      );
    }
    return key;
  }

  /**
   * A read. Same envelope discipline as `call`, no body — Flutterwave's bank
   * list is a GET, and sending it a POST returns a 404 that reads like an
   * outage.
   */
  private async get<T>(path: string): Promise<T> {
    let response: Response;

    try {
      response = await fetch(`${API_BASE}${path}`, {
        headers: { Authorization: `Bearer ${this.secretKey()}` },
        signal: AbortSignal.timeout(TIMEOUT_MS),
        // The bank list changes about as often as a Nigerian bank is founded,
        // and every vendor opening their wallet would otherwise re-fetch it.
        next: { revalidate: 60 * 60 * 24 },
      });
    } catch (cause) {
      throw new GatewayError(`Flutterwave ${path} could not be reached`, this.name, cause);
    }

    const raw = await response.text();

    let envelope: Envelope<T>;
    try {
      envelope = JSON.parse(raw) as Envelope<T>;
    } catch {
      throw new GatewayError(`Flutterwave ${path} returned something that is not JSON`, this.name);
    }

    if (!response.ok || envelope.status === "error" || envelope.data === undefined) {
      throw new GatewayError(
        envelope.message ?? `Flutterwave ${path} failed (${response.status})`,
        this.name,
      );
    }

    return envelope.data;
  }

  /**
   * One POST, one verdict. Flutterwave will happily answer HTTP 200 with
   * `{"status":"error"}` in the body, so the HTTP code alone decides nothing.
   *
   * No response body or request body is ever logged from here, and the key never
   * appears in a message — the whole point of the envelope check is that the
   * caller gets Flutterwave's own `message` and nothing of ours.
   */
  private async call<T>(path: string, body: unknown): Promise<T> {
    let response: Response;

    try {
      response = await fetch(`${API_BASE}${path}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.secretKey()}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(TIMEOUT_MS),
        cache: "no-store",
      });
    } catch (cause) {
      throw new GatewayError(`Flutterwave ${path} could not be reached`, this.name, cause);
    }

    const raw = await response.text();

    let envelope: Envelope<T>;
    try {
      envelope = raw ? (JSON.parse(raw) as Envelope<T>) : {};
    } catch (cause) {
      throw new GatewayError(
        `Flutterwave ${path} answered ${response.status} with a body that is not JSON`,
        this.name,
        cause,
      );
    }

    if (!response.ok || envelope.status !== "success") {
      throw new GatewayError(
        `Flutterwave ${path} failed (HTTP ${response.status}, status "${envelope.status ?? "none"}"): ` +
          `${envelope.message ?? "no message"}`,
        this.name,
      );
    }

    if (envelope.data === undefined || envelope.data === null) {
      throw new GatewayError(`Flutterwave ${path} succeeded but returned no data`, this.name);
    }

    return envelope.data;
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Kobo (integer, the app's only money type) to naira (what Flutterwave's API
 * takes). The.toFixed(2) is not decoration: it pins the value to two decimal
 * places before it is turned back into a number, so 1_000_01 kobo leaves here as
 * 1000.01 and never as 1000.0100000000001.
 */
function koboToNaira(kobo: Kobo): number {
  return Number((Math.round(kobo) / 100).toFixed(2));
}

/**
 * Flutterwave's transfer `reference` is the idempotency key, but it is not a
 * free-form string: keep it to characters the API reliably accepts. The payments
 * service's key is `bookingId:alreadyReleasedKobo:providerId`, which is stable
 * for a given release attempt and survives this untouched.
 */
function transferReference(idempotencyKey: string): string {
  return `nexa_${idempotencyKey.replace(/[^A-Za-z0-9_-]/g, "_")}`;
}

function isDuplicateReference(error: GatewayError): boolean {
  return /duplicate|already exist/i.test(error.message);
}

function narration(request: ReleaseFundsRequest): string {
  return `Nexa payout ${request.gatewayReference}`.slice(0, 100);
}

/**
 * Flutterwave sends no event id. The transaction (or transfer) id plus the event
 * name is the closest thing to one: it is stable across the retries of a single
 * event, and it distinguishes charge.completed from a later refund.completed on
 * the same transaction — which a bare id would collide with, and which the
 * `unique (gateway, event_id)` on payment_webhook_events would then swallow as a
 * duplicate.
 */
function webhookEventId(
  type: string,
  payload: Record<string, unknown>,
  data: Record<string, unknown>,
): string {
  const id =
    data.id ??
    payload.id ??
    data.flw_ref ??
    data.reference ??
    data.tx_ref ??
    "unknown";

  return `${type}:${String(id)}`;
}

/**
 * Constant-time equality of the `verif-hash` header against the configured
 * secret hash. Exported shape kept private to the module: the webhook route
 * cannot import this file— the gateway is private to
 * modules/payments) and repeats the check itself.
 */
function verifySecretHash(received: string, expected: string): boolean {
  const a = createHash("sha256").update(received, "utf8").digest();
  const b = createHash("sha256").update(expected, "utf8").digest();
  return timingSafeEqual(a, b);
}

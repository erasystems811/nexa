import { createHash, timingSafeEqual } from "node:crypto";
import { env } from "../../../env.js";
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
} from "./types.js";

/**
 * Flutterwave adapter. Ported from apps/customer's
 * modules/payments/gateway/flutterwave.ts — identical logic; the Next.js-only
 * `next: { revalidate }` fetch hint is dropped (meaningless outside Next, and
 * would fail typecheck against the plain DOM RequestInit type here).
 *
 * Nexa does not buy an "escrow product". Nexa *is* the escrow, and
 * Flutterwave is only the rails:
 *   holdFunds     hosted checkout, settling into Nexa's own balance.
 *   releaseFunds  a Transfer out of that balance into a provider's account.
 *   refund        a refund of the original charge.
 */

const API_BASE = "https://api.flutterwave.com/v3";
const CURRENCY = "NGN";
const COUNTRY = "NG";
const TIMEOUT_MS = 20_000;

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
        status: String(data.status ?? "").toUpperCase() === "SUCCESSFUL" ? "released" : "pending",
      };
    } catch (error) {
      if (error instanceof GatewayError && isDuplicateReference(error)) {
        return { gatewayReference: reference, status: "pending" };
      }
      throw error;
    }
  }

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

    const data = await this.call<RefundData>(`/transactions/${transactionId}/refund`, {
      amount: koboToNaira(request.amountKobo),
      comments: request.reason.slice(0, 255),
    });

    return {
      gatewayReference: String(data.id ?? transactionId),
      status: String(data.status ?? "").toLowerCase() === "completed" ? "refunded" : "pending",
    };
  }

  parseWebhook(rawBody: string, signature: string | null): WebhookEvent {
    const secret = env.FLUTTERWAVE_WEBHOOK_SECRET;
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
      gatewayReference:
        data.id !== undefined && data.id !== null
          ? String(data.id)
          : ((data.flw_ref as string | undefined) ?? null),
      payload,
    };
  }

  private secretKey(): string {
    const key = env.FLUTTERWAVE_SECRET_KEY;
    if (!key) {
      throw new GatewayError(
        "FLUTTERWAVE_SECRET_KEY is not set. Run with PAYMENT_GATEWAY=mock, or set the key.",
        this.name,
      );
    }
    return key;
  }

  private async get<T>(path: string): Promise<T> {
    let response: Response;

    try {
      response = await fetch(`${API_BASE}${path}`, {
        headers: { Authorization: `Bearer ${this.secretKey()}` },
        signal: AbortSignal.timeout(TIMEOUT_MS),
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

function koboToNaira(kobo: Kobo): number {
  return Number((Math.round(kobo) / 100).toFixed(2));
}

function transferReference(idempotencyKey: string): string {
  return `nexa_${idempotencyKey.replace(/[^A-Za-z0-9_-]/g, "_")}`;
}

function isDuplicateReference(error: GatewayError): boolean {
  return /duplicate|already exist/i.test(error.message);
}

function narration(request: ReleaseFundsRequest): string {
  return `Nexa payout ${request.gatewayReference}`.slice(0, 100);
}

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

function verifySecretHash(received: string, expected: string): boolean {
  const a = createHash("sha256").update(received, "utf8").digest();
  const b = createHash("sha256").update(expected, "utf8").digest();
  return timingSafeEqual(a, b);
}

/**
 * The payment gateway boundary. Ported from apps/customer's
 * modules/payments/gateway/types.ts — unchanged.
 *
 * Nothing in this file names a processor. Nothing outside modules/payments
 * imports this file — eslint.config.mjs enforces that here too.
 */

export type Kobo = number;

export interface GatewayCustomer {
  id: string;
  email: string;
  name?: string;
  phone?: string;
}

export interface HoldFundsRequest {
  reference: string;
  amountKobo: Kobo;
  customer: GatewayCustomer;
  redirectUrl: string;
  metadata?: Record<string, unknown>;
}

export interface HoldFundsResult {
  gatewayReference: string;
  checkoutUrl?: string;
  status: "pending" | "held";
}

export interface ReleaseFundsRequest {
  gatewayReference: string;
  amountKobo: Kobo;
  beneficiary: {
    kind: "provider";
    id: string;
    bankCode: string;
    accountNumber: string;
  };
  idempotencyKey: string;
  metadata?: Record<string, unknown>;
}

export interface ReleaseFundsResult {
  gatewayReference: string;
  status: "pending" | "released";
}

export interface RefundRequest {
  gatewayReference: string;
  amountKobo: Kobo;
  reason: string;
  idempotencyKey: string;
}

export interface RefundResult {
  gatewayReference: string;
  status: "pending" | "refunded";
}

export interface WebhookEvent {
  id: string;
  type: string;
  gatewayReference: string | null;
  payload: unknown;
}

export interface Bank {
  code: string;
  name: string;
}

export interface PaymentGateway {
  readonly name: string;
  listBanks(): Promise<Bank[]>;
  holdFunds(request: HoldFundsRequest): Promise<HoldFundsResult>;
  releaseFunds(request: ReleaseFundsRequest): Promise<ReleaseFundsResult>;
  refund(request: RefundRequest): Promise<RefundResult>;
  parseWebhook(rawBody: string, signature: string | null): WebhookEvent;
}

export class GatewayError extends Error {
  constructor(
    message: string,
    readonly gateway: string,
    readonly cause?: unknown,
  ) {
    super(message);
    this.name = "GatewayError";
  }
}

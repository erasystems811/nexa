/**
 * The payment gateway boundary.:
 *
 *   "The Payments module sits behind an internal interface (e.g. holdFunds,
 *    releaseFunds, refund) that calls out to the payment provider — the escrow
 *    logic and data model do not assume Flutterwave specifically, so the
 *    underlying processor can be swapped without touching booking logic."
 *
 * Nothing in this file names a processor. Nothing outside `modules/payments`
 * imports this file — eslint.config.mjs enforces that, so the rule survives
 * people who have not read the
 */

export type Kobo = number;

export interface GatewayCustomer {
  id: string;
  email: string;
  name?: string;
  phone?: string;
}

export interface HoldFundsRequest {
  /** Nexa's booking reference. Passed through so a gateway dashboard is legible. */
  reference: string;
  /** The whole agreed price. A service booking has no other charge on it. */
  amountKobo: Kobo;
  customer: GatewayCustomer;
  /** Where the customer returns after an off-site checkout page. */
  redirectUrl: string;
  metadata?: Record<string, unknown>;
}

export interface HoldFundsResult {
  gatewayReference: string;
  /** Present when the processor needs the customer on its own checkout page. */
  checkoutUrl?: string;
  status: "pending" | "held";
}

export interface ReleaseFundsRequest {
  gatewayReference: string;
  /** However much of the hold an admin decided to send. There are no stages. */
  amountKobo: Kobo;
  beneficiary: {
    kind: "provider";
    id: string;
    bankCode: string;
    accountNumber: string;
  };
  /**
   * Caller-generated and derived from the escrow's state, not random. A
   * double-clicked admin button must not pay twice; two deliberate partial
   * releases must both go through.
   */
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

export interface PaymentGateway {
  readonly name: string;

  /** Takes the customer's money and holds it. Nothing reaches the provider yet. */
  holdFunds(request: HoldFundsRequest): Promise<HoldFundsResult>;

  /** Moves some or all of the held funds to a provider. */
  releaseFunds(request: ReleaseFundsRequest): Promise<ReleaseFundsResult>;

  /** Returns money to the customer, in whole or in part. */
  refund(request: RefundRequest): Promise<RefundResult>;

  /** Verifies a callback's signature and normalises it. Throws if unauthentic. */
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

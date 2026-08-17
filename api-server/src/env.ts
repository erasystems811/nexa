import { z } from "zod";

/** Fails at boot rather than at the first request that needed a missing key. */
const schema = z.object({
  PORT: z.coerce.number().default(4000),
  SUPABASE_URL: z.string().url(),
  SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  // Comma-separated list of frontend origins allowed to call this server —
  // the three apps' dev + deployed URLs. e.g.
  // "http://localhost:3000,http://localhost:5173,https://nexa.erasystems.com.ng"
  CORS_ORIGINS: z.string().default("http://localhost:3000"),

  // Payments — Nexa IS the escrow; "mock" moves no real money.
  PAYMENT_GATEWAY: z.enum(["mock", "flutterwave"]).default("mock"),
  FLUTTERWAVE_SECRET_KEY: z.string().optional(),
  FLUTTERWAVE_WEBHOOK_SECRET: z.string().optional(),

  // Where the payment gateway sends a customer back to after checkout, when
  // the caller doesn't supply its own redirect builder.
  CUSTOMER_APP_URL: z.string().url().default("http://localhost:3000"),
  // The Vendor Business Studio and Admin Console apps — separate origins now
  // that they're their own deployables. Password-setup/reset emails link to
  // whichever app the account belongs to.
  STUDIO_APP_URL: z.string().url().default("http://localhost:5173"),
  ADMIN_APP_URL: z.string().url().default("http://localhost:5174"),

  // Transactional email via Resend.
  RESEND_API_KEY: z.string().optional(),
  RESEND_FROM_EMAIL: z.string().optional(),

  // Fixed admin login. The username is what the Admin Console form takes; the
  // email is the hidden Supabase Auth user that actually carries the session.
  NEXA_SUPER_ADMIN_USERNAME: z.string().optional(),
  NEXA_SUPER_ADMIN_EMAIL: z.string().email().optional(),
  NEXA_SUPER_ADMIN_PASSWORD: z.string().min(8).optional(),

  // Outbound WhatsApp notifications only (vendor "new booking" ping, customer
  // "offer accept" button) — the inbound bot/webhook itself is still
  // apps/customer's, unaffected by these. Unset means whatsappIsConfigured()
  // is false and every notify call here is a silent no-op, same as it was
  // when this lived in apps/customer.
  WHATSAPP_ACCESS_TOKEN: z.string().optional(),
  WHATSAPP_PHONE_NUMBER_ID: z.string().optional(),
  WHATSAPP_TEMPLATE_NAME: z.string().default("nexa_new_message"),
  WHATSAPP_TEMPLATE_LANG: z.string().default("en"),
});

export const env = schema.parse(process.env);

export const corsOrigins = env.CORS_ORIGINS.split(",").map((s) => s.trim()).filter(Boolean);

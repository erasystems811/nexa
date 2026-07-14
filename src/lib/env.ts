import { z } from "zod";

/**
 * Fails at boot rather than at the first request that needed a missing key.
 */
const publicSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  NEXT_PUBLIC_SITE_URL: z.string().url().default("http://localhost:3000"),
  // The live customer apex, e.g. "nexa.erasystems.com.ng". When set, the app
  // serves each surface on its own subdomain Unset in dev and on
  // the raw Railway URL, where the app is single-domain and path-based.
  NEXT_PUBLIC_ROOT_DOMAIN: z.string().optional(),
  NEXT_PUBLIC_WHATSAPP_NUMBER: z.string().optional(),
});

const serverSchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  PAYMENT_GATEWAY: z.enum(["mock", "flutterwave"]).default("mock"),
  FLUTTERWAVE_SECRET_KEY: z.string().optional(),
  FLUTTERWAVE_ENCRYPTION_KEY: z.string().optional(),
  FLUTTERWAVE_WEBHOOK_SECRET: z.string().optional(),

  // Transactional email via Resend.
  RESEND_API_KEY: z.string().optional(),
  RESEND_FROM_EMAIL: z.string().optional(),


  // WhatsApp Business Platform. Optional until Nexa has a Meta business number.
  WHATSAPP_ACCESS_TOKEN: z.string().optional(),
  WHATSAPP_PHONE_NUMBER_ID: z.string().optional(),
  WHATSAPP_VERIFY_TOKEN: z.string().optional(),
  WHATSAPP_APP_SECRET: z.string().optional(),

  // The approved Meta template used to reopen a closed 24-hour window.
  WHATSAPP_TEMPLATE_NAME: z.string().default("nexa_new_message"),
  WHATSAPP_TEMPLATE_LANG: z.string().default("en"),

  // Fixed admin login. The username is what Admin types; the email is the
  // hidden Supabase Auth user that carries the admin session.
  NEXA_SUPER_ADMIN_USERNAME: z.string().optional(),
  NEXA_SUPER_ADMIN_EMAIL: z.string().email().optional(),
  NEXA_SUPER_ADMIN_PASSWORD: z.string().min(8).optional(),
});

// Next.js inlines NEXT_PUBLIC_* only when referenced statically, so these cannot
// be pulled off a spread of process.env.
export const publicEnv = publicSchema.parse({
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
  NEXT_PUBLIC_ROOT_DOMAIN: process.env.NEXT_PUBLIC_ROOT_DOMAIN,
  NEXT_PUBLIC_WHATSAPP_NUMBER: process.env.NEXT_PUBLIC_WHATSAPP_NUMBER,
});

let cachedServerEnv: z.infer<typeof serverSchema> | null = null;

/**
 * Server-only. Reading this from a client component is a build error waiting to
 * happen - the service role key must never cross into the browser bundle.
 */
export function serverEnv() {
  if (typeof window !== "undefined") {
    throw new Error("serverEnv() was called in the browser");
  }
  cachedServerEnv ??= serverSchema.parse(process.env);
  return cachedServerEnv;
}

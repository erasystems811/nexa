import { z } from "zod";

/**
 * Fails at boot rather than at the first request that needed a missing key.
 */
const publicSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  NEXT_PUBLIC_SITE_URL: z.string().url().default("http://localhost:3000"),
  // The live customer apex, e.g. "nexa.erasystems.com.ng". When set, the app
  // serves each surface on its own subdomain (Addendum §2). Unset in dev and on
  // the raw Railway URL, where the app is single-domain and path-based.
  NEXT_PUBLIC_ROOT_DOMAIN: z.string().optional(),
});

const serverSchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  PAYMENT_GATEWAY: z.enum(["mock", "flutterwave"]).default("mock"),
  FLUTTERWAVE_SECRET_KEY: z.string().optional(),
  FLUTTERWAVE_ENCRYPTION_KEY: z.string().optional(),
  FLUTTERWAVE_WEBHOOK_SECRET: z.string().optional(),

  // Masked calling. "mock" until a provider account and a proxy number pool
  // exist (PRD Section 08).
  TELEPHONY_PROVIDER: z.enum(["mock", "africastalking"]).default("mock"),
  TELEPHONY_API_KEY: z.string().optional(),
  TELEPHONY_USERNAME: z.string().optional(),
  TELEPHONY_WEBHOOK_SECRET: z.string().optional(),
});

// Next.js inlines NEXT_PUBLIC_* only when referenced statically, so these cannot
// be pulled off a spread of process.env.
export const publicEnv = publicSchema.parse({
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
  NEXT_PUBLIC_ROOT_DOMAIN: process.env.NEXT_PUBLIC_ROOT_DOMAIN,
});

let cachedServerEnv: z.infer<typeof serverSchema> | null = null;

/**
 * Server-only. Reading this from a client component is a build error waiting to
 * happen — the service role key must never cross into the browser bundle.
 */
export function serverEnv() {
  if (typeof window !== "undefined") {
    throw new Error("serverEnv() was called in the browser");
  }
  cachedServerEnv ??= serverSchema.parse(process.env);
  return cachedServerEnv;
}

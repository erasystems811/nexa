import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!url || !anonKey) {
  throw new Error("VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY are not set");
}

/** Direct browser Supabase Auth client — Studio signs in against Supabase itself, same as the old cookie-based app, just client-side now. */
export const supabase = createClient(url, anonKey);

/**
 * The vendor account's stored auth email is tagged (`+nexa-vendor@...`), kept
 * independent from a customer account under the same real address. Mirrors
 * api-server's modules/auth/identity.ts authEmailFor("studio", email).
 */
export function vendorAuthEmail(realEmail: string): string {
  const email = realEmail.trim().toLowerCase();
  const at = email.lastIndexOf("@");
  if (at === -1) return email;
  return `${email.slice(0, at)}+nexa-vendor@${email.slice(at + 1)}`;
}

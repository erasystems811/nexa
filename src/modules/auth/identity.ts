import type { Surface } from "@/lib/surfaces";

/**
 * The email an account is STORED under in the auth engine, per app.
 *
 * Each surface is its own independent account list, keyed by (real email, app).
 * The auth engine (Supabase) allows an email only once, so the stored email is
 * made unique per app: the customer app keeps the bare email, and the vendor app
 * tags it. The same person can therefore hold a customer account AND a vendor
 * account under one real email — two separate logins that know nothing of each
 * other, exactly as two unrelated websites would behave.
 *
 * The person always TYPES and RECEIVES email at their real address; the tag is
 * internal. Verification and reset codes are sent by Nexa (Resend) to the real
 * address — never to the tagged one — so the tag never has to be deliverable.
 *
 * Admin is deliberately left bare: it is a single env-provisioned super-admin
 * login, not a per-person signup, so there is nothing to keep independent.
 */
export function authEmailFor(surface: Surface | null | undefined, realEmail: string): string {
  const email = realEmail.trim().toLowerCase();
  if (surface === "studio") return tagEmail(email, "vendor");
  return email;
}

/** True when a stored auth email is a tagged vendor address. */
export function isVendorAuthEmail(authEmail: string): boolean {
  return /\+nexa-vendor@/i.test(authEmail);
}

/** Narrows the surface a login form posted; anything unrecognised is treated as the customer app. */
export function surfaceFromForm(value: FormDataEntryValue | null): Surface {
  return value === "studio" || value === "admin" ? value : "customer";
}

/**
 * Inserts a `+nexa-<label>` tag before the @, keeping a valid, unique email. A
 * bare `foo@x.com` becomes `foo+nexa-vendor@x.com`; an address that already
 * carries a plus tag simply gains another, which is still valid and still unique.
 */
function tagEmail(email: string, label: string): string {
  const at = email.lastIndexOf("@");
  if (at === -1) return email;
  return `${email.slice(0, at)}+nexa-${label}@${email.slice(at + 1)}`;
}

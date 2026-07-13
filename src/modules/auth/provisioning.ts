import "server-only";

import type { User } from "@supabase/supabase-js";
import { publicEnv, serverEnv } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendPasswordResetCode, sendPasswordSetupCode } from "@/modules/email/resend";

/**
 * Provisioning — logins Nexa creates on someone's behalf, and the codes that let
 * them take ownership of one.
 *
 * Admin adds vendors and staff in person, so their auth user is created without
 * a password. Without this module such an account can never be signed into: the
 * only way in is a recovery code, which is the same numeric OTP the signup flow
 * emails (Supabase returns it on generateLink), entered at /reset.
 *
 * Both admin paths must be re-runnable against an email that already has an
 * account — a vendor who once signed up as a customer is the normal case, and
 * createUser on that email fails outright.
 */

const PAGE_SIZE = 200;
/** listUsers has no email filter, so it is paged. The cap keeps a bad call bounded. */
const MAX_PAGES = 50;

export async function findAuthUserByEmail(email: string): Promise<User | null> {
  const admin = createAdminClient();
  const needle = email.trim().toLowerCase();

  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: PAGE_SIZE });
    if (error) throw new Error(error.message);

    const match = data.users.find((user) => user.email?.toLowerCase() === needle);
    if (match) return match;
    if (data.users.length < PAGE_SIZE) return null;
  }
  return null;
}

export interface EnsuredUser {
  user: User;
  /** False when an account for this email already existed and was reused. */
  created: boolean;
}

/**
 * The auth user for an email, creating one only if it is genuinely new. The new
 * account gets no password on purpose — the person sets their own from the code
 * we email them, so a password an admin typed never exists to be leaked.
 */
export async function ensureAuthUser(input: { email: string; fullName: string }): Promise<EnsuredUser> {
  const admin = createAdminClient();
  const email = input.email.trim().toLowerCase();

  const existing = await findAuthUserByEmail(email);
  if (existing) return { user: existing, created: false };

  const { data, error } = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: { full_name: input.fullName },
  });

  // A race (or an account listUsers could not see) still lands here; fall back
  // to the existing account rather than failing the whole admin action.
  if (error || !data.user) {
    const raced = await findAuthUserByEmail(email);
    if (raced) return { user: raced, created: false };
    throw new Error(error?.message ?? "Could not create the account");
  }

  return { user: data.user, created: true };
}

function isEmailConfigured(): boolean {
  const env = serverEnv();
  return Boolean(env.RESEND_API_KEY && env.RESEND_FROM_EMAIL);
}

function resetUrl(email: string): string {
  return `${publicEnv.NEXT_PUBLIC_SITE_URL}/reset?email=${encodeURIComponent(email)}&step=code`;
}

/**
 * Emails the recovery OTP for an existing account. Supabase hands the code back
 * on generateLink, so Nexa sends it with its own Resend template — the same
 * mechanism signup verification uses. Throws if there is no such account.
 */
export async function sendPasswordCode(input: {
  email: string;
  name?: string;
  purpose: "reset" | "setup";
}): Promise<void> {
  const admin = createAdminClient();
  const email = input.email.trim().toLowerCase();

  const { data, error } = await admin.auth.admin.generateLink({
    type: "recovery",
    email,
    options: { redirectTo: `${publicEnv.NEXT_PUBLIC_SITE_URL}/reset` },
  });
  if (error) throw new Error(error.message);

  const code = data.properties?.email_otp;
  if (!code) throw new Error("Supabase did not return a recovery code");

  const payload = { to: email, name: input.name, code, actionUrl: resetUrl(email) };
  if (input.purpose === "setup") await sendPasswordSetupCode(payload);
  else await sendPasswordResetCode(payload);
}

/**
 * The set-password email for an account an admin just created. Best-effort: a
 * vendor record that is otherwise correct must not be lost because Resend is
 * unset or down, so the failure comes back as a warning the console shows,
 * not an exception. The person can still get in via Forgot password.
 */
export async function trySendPasswordSetupCode(input: { email: string; name?: string }): Promise<string | undefined> {
  if (!isEmailConfigured()) {
    return `Email is not configured, so no set-password email went to ${input.email}. Configure Resend, or ask them to use "Forgot password?" on the sign-in page.`;
  }

  try {
    await sendPasswordCode({ email: input.email, name: input.name, purpose: "setup" });
    return undefined;
  } catch {
    return `The account is ready, but the set-password email to ${input.email} could not be sent. Ask them to use "Forgot password?" on the sign-in page.`;
  }
}

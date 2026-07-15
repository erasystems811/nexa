"use server";

import type { Route } from "next";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { publicEnv, serverEnv } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { sendSignupVerificationCode } from "@/modules/email/resend";
import { sendPasswordCode } from "./provisioning";
import type { UserRole } from "@/lib/db/types";

export interface AuthFormState {
  error?: string;
  message?: string;
}

/**
 * `sent` is what moves the /reset form from "enter email" to "enter code";
 * `email` carries the address across that step so it is not re-typed.
 */
export interface PasswordResetState extends AuthFormState {
  sent?: boolean;
  email?: string;
}

const loginCredentials = z.object({
  identifier: z.string().trim().min(1, "Enter your username or email"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

const credentials = z.object({
  email: z.string().email("Enter a valid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

const registration = credentials.extend({
  fullName: z.string().min(2, "Enter your full name"),
  phone: z.string().min(7, "Enter a valid phone number").optional().or(z.literal("")),
});

function safeNextPath(value: FormDataEntryValue | null): string | null {
  if (typeof value !== "string" || !value.startsWith("/")) return null;
  if (value.startsWith("//")) return null;
  return value;
}

function isAdminIntent(next: string | null, surface: FormDataEntryValue | null): boolean {
  return surface === "admin" || next === "/admin" || next?.startsWith("/admin/") === true;
}

async function ensureEnvSuperAdmin(email: string, password: string): Promise<void> {
  const admin = createAdminClient();
  const normalizedEmail = email.toLowerCase();
  const { data: listed, error: listError } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (listError) throw new Error(listError.message);

  const existing = listed.users.find((user) => user.email?.toLowerCase() === normalizedEmail);
  const metadata = { role: "admin" };
  const userMetadata = { full_name: "Nexa Super Admin" };

  const userId = existing?.id;
  if (userId) {
    const { error } = await admin.auth.admin.updateUserById(userId, {
      password,
      email_confirm: true,
      app_metadata: { ...(existing.app_metadata ?? {}), ...metadata },
      user_metadata: { ...(existing.user_metadata ?? {}), ...userMetadata },
    });
    if (error) throw new Error(error.message);
  } else {
    const { data, error } = await admin.auth.admin.createUser({
      email: normalizedEmail,
      password,
      email_confirm: true,
      app_metadata: metadata,
      user_metadata: userMetadata,
    });
    if (error || !data.user) throw new Error(error?.message ?? "Could not create the admin login");
  }

  const resolvedUserId = userId ?? (await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })).data.users.find((user) => user.email?.toLowerCase() === normalizedEmail)?.id;
  if (!resolvedUserId) throw new Error("Could not resolve the admin login");

  const { error: profileError } = await admin.from("profiles").upsert({
    id: resolvedUserId,
    role: "admin",
    full_name: "Nexa Super Admin",
  }, { onConflict: "id" });
  if (profileError) throw new Error(profileError.message);

  const { error: staffError } = await admin.from("staff_members").upsert({
    user_id: resolvedUserId,
    staff_role: "super_admin",
    permissions: [],
    status: "active",
  }, { onConflict: "user_id" });
  if (staffError) throw new Error(staffError.message);
}

export async function signIn(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const next = safeNextPath(formData.get("next"));
  const surface = formData.get("surface");
  const adminIntent = isAdminIntent(next, surface);
  const parsed = loginCredentials.safeParse({
    identifier: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid credentials" };
  }

  let loginEmail = parsed.data.identifier;
  let password = parsed.data.password;

  if (adminIntent) {
    const env = serverEnv();
    const username = env.NEXA_SUPER_ADMIN_USERNAME?.trim();
    const email = env.NEXA_SUPER_ADMIN_EMAIL?.trim();
    // Trimmed, like the username and email above. Railway (and .env files)
    // routinely leave a trailing newline or space on a pasted value, and a
    // password compared raw would then never match what someone actually types.
    // The trimmed value is the effective password everywhere below, so Supabase
    // is set to the same thing the compare accepts.
    const adminPassword = env.NEXA_SUPER_ADMIN_PASSWORD?.trim();

    if (!username || !email || !adminPassword) {
      return { error: "Admin login is not configured yet. Set the Nexa Super Admin env values in Railway." };
    }

    if (parsed.data.identifier.toLowerCase() !== username.toLowerCase() || parsed.data.password.trim() !== adminPassword) {
      return { error: "Admin username and password do not match." };
    }

    try {
      await ensureEnvSuperAdmin(email, adminPassword);
    } catch {
      return { error: "Admin login could not be prepared. Check the Supabase service key and admin env values." };
    }

    loginEmail = email;
    password = adminPassword;
  } else {
    const emailParsed = credentials.pick({ email: true }).safeParse({ email: parsed.data.identifier });
    if (!emailParsed.success) {
      return { error: emailParsed.error.issues[0]?.message ?? "Enter a valid email address" };
    }
    loginEmail = emailParsed.data.email;
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email: loginEmail, password });
  if (error) {
    const message = error.message.toLowerCase();
    if (message.includes("email not confirmed")) {
      return { error: "Your account exists, but it has not been verified yet. Enter the code from your email." };
    }
    if (message.includes("invalid login credentials")) {
      return { error: adminIntent ? "Admin username and password do not match." : "That email and password do not match. If this is your first time, create an account first." };
    }
    return { error: error.message };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  let role = (user?.app_metadata?.role as UserRole | undefined) ?? null;

  if (user && !role) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();
    role = profile?.role ?? null;
  }

  if (adminIntent && role !== "admin") {
    await supabase.auth.signOut();
    return { error: "This login is not allowed to open Admin." };
  }

  if (!adminIntent && role === "admin") {
    await supabase.auth.signOut();
    return { error: "Admin accounts must sign in from Nexa Admin." };
  }

  revalidatePath("/", "layout");

  // You stay on the site you signed in on. The three surfaces are standalone and
  // no longer share a session, so sending someone to their role's *other*
  // subdomain would land them there signed out — the login they just completed
  // does not exist over there. "/" is the right answer on every surface: the
  // customer marketplace on the root, Business Studio (or the application status)
  // on vendor.<root>, the console on admin.<root>. `next` is already a path on
  // this same host, so it is safe too.
  redirect((next ?? "/") as Route);
}

/**
 * Sign-up always creates a customer. Becoming a provider is an application an
 * admin approves; the DB trigger `handle_new_user` hard-codes customer for new
 * accounts, so no `role` field here would do anything even if posted.
 */
export async function signUp(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = registration.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    fullName: formData.get("fullName"),
    phone: formData.get("phone") ?? "",
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check your details" };
  }

  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.generateLink({
    type: "signup",
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: { full_name: parsed.data.fullName, phone: parsed.data.phone },
      redirectTo: `${publicEnv.NEXT_PUBLIC_SITE_URL}/login`,
    },
  });

  if (error) {
    const message = error.message.toLowerCase();
    if (message.includes("already registered") || message.includes("already exists") || message.includes("user already")) {
      return { error: "An account already exists for this email. Sign in instead." };
    }
    return { error: error.message };
  }

  const code = data.properties?.email_otp;
  if (!code) {
    return { error: "Account created, but Nexa could not create a verification code. Please contact support." };
  }

  try {
    await sendSignupVerificationCode({
      to: parsed.data.email,
      name: parsed.data.fullName,
      code,
    });
  } catch {
    return { error: "Account created, but Nexa could not send the verification code. Check Resend settings and try again." };
  }

  redirect(`/verify?email=${encodeURIComponent(parsed.data.email)}` as Route);
}

export async function verifySignupCode(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const email = String(formData.get("email") ?? "").trim();
  const token = String(formData.get("code") ?? "").replace(/\D/g, "");

  if (!email || token.length < 6 || token.length > 8) {
    return { error: "Enter the verification code from your email." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({
    email,
    token,
    type: "signup",
  });

  if (error) {
    return { error: "That code is not correct or has expired. Check the email and try again." };
  }

  revalidatePath("/", "layout");
  redirect("/");
}

const resetRequest = z.object({
  email: z.string().email("Enter a valid email address"),
});

const resetCompletion = z.object({
  email: z.string().email("Enter a valid email address"),
  // Supabase OTPs are 6 digits today but the length is configurable; the signup
  // flow already accepts up to 8, so this one does too.
  code: z.string().regex(/^\d{6,8}$/, "Enter the code from your email"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

/**
 * Step 1 of a password reset — and the way anyone Admin created (vendors, staff)
 * gets into an account that was made without a password.
 *
 * The response is identical whether or not the email has an account: an
 * unauthenticated form that says "no such user" is an account enumerator.
 * Failures to generate or send are swallowed for the same reason.
 */
export async function requestPasswordReset(
  _prev: PasswordResetState,
  formData: FormData,
): Promise<PasswordResetState> {
  const parsed = resetRequest.safeParse({ email: formData.get("email") });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Enter a valid email address" };
  }

  try {
    await sendPasswordCode({ email: parsed.data.email, purpose: "reset" });
  } catch {
    // Deliberate: no account, or email is down. Both look like success here.
  }

  return {
    sent: true,
    email: parsed.data.email,
    message: `If ${parsed.data.email} has a Nexa account, a reset code is on its way. Enter it below.`,
  };
}

/**
 * Step 2 — the recovery OTP is verified, which signs the person in, and only
 * then is the new password written. Verifying is what proves they own the
 * mailbox, so this is also how a never-signed-in vendor or staff member gets
 * their first password.
 */
export async function completePasswordReset(
  _prev: PasswordResetState,
  formData: FormData,
): Promise<PasswordResetState> {
  const email = String(formData.get("email") ?? "").trim();
  const parsed = resetCompletion.safeParse({
    email,
    code: String(formData.get("code") ?? "").replace(/\D/g, ""),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { sent: true, email, error: parsed.error.issues[0]?.message ?? "Check your details" };
  }

  const supabase = await createClient();
  const { error: otpError } = await supabase.auth.verifyOtp({
    email: parsed.data.email,
    token: parsed.data.code,
    type: "recovery",
  });
  if (otpError) {
    return { sent: true, email, error: "That code is not correct or has expired. Request a new one and try again." };
  }

  const { error: updateError } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (updateError) {
    return { sent: true, email, error: updateError.message };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  let role = (user?.app_metadata?.role as UserRole | undefined) ?? null;

  if (user && !role) {
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
    role = profile?.role ?? null;
  }

  revalidatePath("/", "layout");
  // Stay on the site where the password was just set, for the same reason sign-in
  // does: the session is host-only now, and the role's other subdomain would not
  // recognise it. "/" resolves to the right home on whichever surface this is.
  redirect("/" as Route);
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/login");
}

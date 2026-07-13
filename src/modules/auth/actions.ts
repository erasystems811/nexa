"use server";

import type { Route } from "next";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { publicEnv } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { sendSignupConfirmationEmail } from "@/modules/email/resend";
import { homePathForRole } from "./session";
import type { UserRole } from "@/lib/db/types";

export interface AuthFormState {
  error?: string;
  message?: string;
}

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
export async function signIn(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = credentials.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid credentials" };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    const message = error.message.toLowerCase();
    if (message.includes("email not confirmed")) {
      return { error: "Your account exists, but the email has not been confirmed yet. Check your email, then sign in again." };
    }
    if (message.includes("invalid login credentials")) {
      return { error: "That email and password do not match. If this is your first time, create an account first." };
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

  revalidatePath("/", "layout");
  redirect((safeNextPath(formData.get("next")) ?? homePathForRole(role ?? "customer")) as Route);
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

  const confirmationUrl = data.properties?.action_link;
  if (!confirmationUrl) {
    return { error: "Account created, but Nexa could not create a confirmation email link. Please contact support." };
  }

  try {
    await sendSignupConfirmationEmail({
      to: parsed.data.email,
      name: parsed.data.fullName,
      confirmationUrl,
    });
  } catch {
    return { error: "Account created, but Nexa could not send the confirmation email. Check Resend settings and try again." };
  }

  return { message: "Account created. Check your email for the Nexa confirmation link, then sign in." };
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/login");
}

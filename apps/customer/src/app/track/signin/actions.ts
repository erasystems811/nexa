"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export interface PhoneSignInState {
  error?: string;
  phone?: string;
}

/**
 * Phone+password sign-in, entirely separate from the email-based signIn() in
 * src/modules/auth/actions.ts - a WhatsApp-only account has no email at all,
 * so it was never a candidate for that flow, and this avoids touching a file
 * with per-app-surface email-tagging logic that has nothing to do with phone
 * identities.
 */
export async function signInWithPhoneAction(
  _prev: PhoneSignInState,
  formData: FormData,
): Promise<PhoneSignInState> {
  const phone = String(formData.get("phone") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!phone || !password) {
    return { error: "Enter your WhatsApp number and password", phone };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ phone, password });

  if (error) {
    return { error: "That number and password don't match", phone };
  }

  redirect("/orders");
}

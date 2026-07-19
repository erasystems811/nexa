"use server";

import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/modules/auth";

export interface ContactState {
  error?: string;
  done?: boolean;
}

/**
 * The general "contact Nexa" form - works whether or not the visitor is
 * signed in. RLS (support_requests_insert) allows both anon and authenticated
 * inserts, since a question a visitor has doesn't require an account first.
 */
export async function submitContactAction(
  _prev: ContactState,
  formData: FormData,
): Promise<ContactState> {
  const name = String(formData.get("name") ?? "").trim();
  const contact = String(formData.get("contact") ?? "").trim();
  const message = String(formData.get("message") ?? "").trim();

  if (!contact) return { error: "Enter an email or phone number so Nexa can reach you back" };
  if (!message) return { error: "Enter your message" };

  const session = await getSession();
  const supabase = await createClient();

  const { error } = await supabase.from("support_requests").insert({
    channel: "web",
    customer_id: session?.userId ?? null,
    name: name || session?.profile.full_name || null,
    contact,
    message,
  });

  if (error) return { error: "Could not send that - please try again" };
  return { done: true };
}

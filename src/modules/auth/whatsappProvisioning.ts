import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { toWhatsAppNumber } from "@/lib/phone";

/**
 * A headless (phone-only, passwordless) Nexa customer account for someone who
 * only ever talks to Nexa through WhatsApp - the same createUser-without-a-
 * password pattern src/modules/auth/provisioning.ts uses for admin-provisioned
 * vendor/staff accounts, just keyed by phone instead of email.
 */
export async function ensureWhatsappCustomer(input: {
  waId: string;
  contactId: string;
  displayName?: string | null;
}): Promise<{ profileId: string }> {
  const db = createAdminClient();

  const { data: contact } = await db
    .from("whatsapp_contacts")
    .select("profile_id")
    .eq("id", input.contactId)
    .maybeSingle();

  if (contact?.profile_id) return { profileId: contact.profile_id };

  // Someone who already has a real Nexa account should be linked to it, not
  // forked into a second, WhatsApp-only one. profiles.phone isn't guaranteed
  // to be stored in the same shape as a WhatsApp id, so both forms are tried.
  const normalized = toWhatsAppNumber(input.waId);
  const candidates = [...new Set([input.waId, normalized].filter((v): v is string => Boolean(v)))];

  const { data: existingProfile } = await db
    .from("profiles")
    .select("id")
    .in("phone", candidates)
    .limit(1)
    .maybeSingle();

  if (existingProfile) {
    await db.from("whatsapp_contacts").update({ profile_id: existingProfile.id }).eq("id", input.contactId);
    return { profileId: existingProfile.id };
  }

  const fullName = input.displayName?.trim() || "WhatsApp customer";

  // handle_new_user() (migration 0002) only reads full_name/phone from
  // raw_user_meta_data, never the top-level auth.users columns - so phone must
  // be duplicated into user_metadata or the profiles row it creates comes out
  // with phone null.
  const { data, error } = await db.auth.admin.createUser({
    phone: input.waId,
    phone_confirm: true,
    user_metadata: { full_name: fullName, phone: input.waId },
  });

  if (error || !data.user) {
    throw new Error(`Could not create a WhatsApp customer account: ${error?.message}`);
  }

  await db.from("whatsapp_contacts").update({ profile_id: data.user.id }).eq("id", input.contactId);
  return { profileId: data.user.id };
}

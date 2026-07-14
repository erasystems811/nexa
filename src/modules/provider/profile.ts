import "server-only";

import { createClient } from "@/lib/supabase/server";
import { ProviderError } from "./context";

/**
 * Business profile.: name, logo, cover, description, location,
 * contact, social links, business hours.
 *
 * Contact phone and email live in provider_contacts, unreadable by the
 * public. A provider edits their own; a customer never sees them.
 * Verification and featured status are Admin's, enforced by
 * guard_provider_self_approval — not editable here.
 *
 * There is no agreement to read any more: 0030 dropped provider_agreements
 * along with every percentage it carried. Nexa holds the whole amount a customer
 * pays and settles the vendor once the job is done, so there are no terms to
 * negotiate per vendor.
 */

export interface ProfileUpdate {
  business_name?: string;
  description?: string;
  address?: string;
  logo_url?: string | null;
  cover_url?: string | null;
  social_links?: Record<string, string>;
  business_hours?: Record<string, unknown>;
}

export async function updateProfile(providerId: string, patch: ProfileUpdate): Promise<void> {
  const supabase = await createClient();
  // social_links / business_hours are jsonb; the generated Json type rejects a
  // plain Record, so cast at this single boundary rather than everywhere upstream.
  const { error } = await supabase
    .from("providers")
    .update(patch as never)
    .eq("id", providerId);
  if (error) throw new ProviderError(error.message);
}

export async function getContact(providerId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("provider_contacts")
    .select("contact_phone, contact_email")
    .eq("provider_id", providerId)
    .maybeSingle();
  return data;
}

export async function updateContact(
  providerId: string,
  patch: { contact_phone?: string; contact_email?: string },
): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("provider_contacts")
    .update(patch)
    .eq("provider_id", providerId);
  if (error) throw new ProviderError(error.message);
}

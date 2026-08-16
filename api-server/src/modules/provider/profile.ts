import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@nexa/db-types/src/types";
import { createAdminClient } from "../../supabase.js";
import { ProviderError } from "./context.js";

/**
 * Business profile. Ported from apps/customer's modules/provider/profile.ts
 * — unchanged. Verification and featured status stay Admin's, enforced by
 * guard_provider_self_approval, not editable here.
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

const PROFILE_BUCKET = "provider-profile-media";
const MAX_PROFILE_PHOTO_BYTES = 10 * 1024 * 1024;
const ACCEPTED_PROFILE_MIME = ["image/jpeg", "image/png", "image/webp", "image/avif"];

/** Logo or cover photo — uploaded with the service role, same as apply.ts does for this bucket; the caller already proved they own this provider. */
export async function uploadProfilePhoto(
  supabase: SupabaseClient<Database>,
  providerId: string,
  kind: "logo" | "cover",
  file: File,
): Promise<string> {
  if (!ACCEPTED_PROFILE_MIME.includes(file.type)) {
    throw new ProviderError("Use a JPG, PNG, WEBP or AVIF image.");
  }
  if (file.size > MAX_PROFILE_PHOTO_BYTES) {
    throw new ProviderError("That photo is too large. Keep it under 10MB.");
  }

  const ext = file.name.split(".").pop() ?? "jpg";
  const path = `${providerId}/${kind}.${ext}`;

  const admin = createAdminClient();
  const { error: uploadError } = await admin.storage
    .from(PROFILE_BUCKET)
    .upload(path, file, { contentType: file.type, upsert: true });
  if (uploadError) throw new ProviderError(`Upload failed: ${uploadError.message}`);

  const { data } = admin.storage.from(PROFILE_BUCKET).getPublicUrl(path);
  const url = `${data.publicUrl}?v=${Date.now()}`;

  await updateProfile(supabase, providerId, kind === "logo" ? { logo_url: url } : { cover_url: url });
  return url;
}

export async function updateProfile(
  supabase: SupabaseClient<Database>,
  providerId: string,
  patch: ProfileUpdate,
): Promise<void> {
  const { error } = await supabase
    .from("providers")
    .update(patch as never)
    .eq("id", providerId);
  if (error) throw new ProviderError(error.message);
}

export async function getContact(supabase: SupabaseClient<Database>, providerId: string) {
  const { data } = await supabase
    .from("provider_contacts")
    .select("contact_phone, contact_email")
    .eq("provider_id", providerId)
    .maybeSingle();
  return data;
}

export async function updateContact(
  supabase: SupabaseClient<Database>,
  providerId: string,
  patch: { contact_phone?: string; contact_email?: string },
): Promise<void> {
  const { error } = await supabase.from("provider_contacts").update(patch).eq("provider_id", providerId);
  if (error) throw new ProviderError(error.message);
}

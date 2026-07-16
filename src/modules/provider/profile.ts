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

const PROFILE_BUCKET = "provider-profile-media";
const MAX_PROFILE_PHOTO_BYTES = 10 * 1024 * 1024;
const ACCEPTED_PROFILE_MIME = ["image/jpeg", "image/png", "image/webp", "image/avif"];

/**
 * Logo or cover photo. Uploads to a fixed path per provider+kind (upsert), so
 * re-uploading replaces the old file instead of piling up orphans, and returns
 * the public URL to store on the provider row directly — no signed URL, no
 * expiry, because this bucket is public by design (0035).
 */
export async function uploadProfilePhoto(
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
  const supabase = await createClient();

  const { error: uploadError } = await supabase.storage
    .from(PROFILE_BUCKET)
    .upload(path, file, { contentType: file.type, upsert: true });
  if (uploadError) throw new ProviderError(`Upload failed: ${uploadError.message}`);

  const { data } = supabase.storage.from(PROFILE_BUCKET).getPublicUrl(path);
  // A fresh upload at the same path needs a cache-busting query param, or the
  // browser (and any CDN in front of Supabase) keeps serving the old photo.
  const url = `${data.publicUrl}?v=${Date.now()}`;

  await updateProfile(providerId, kind === "logo" ? { logo_url: url } : { cover_url: url });
  return url;
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

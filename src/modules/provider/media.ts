import "server-only";

import { createClient } from "@/lib/supabase/server";
import { ProviderError } from "./context";

/**
 * Listing media. PRD Section 06/13: every upload enters Pending Approval.
 *
 * The file lands in the private provider-media bucket under the provider's own
 * id prefix (0018 storage policies). The row that points at it is forced to
 * pending_approval by guard_listing_media_status (0011). Neither the file nor
 * the row is publicly visible until an Admin approves it.
 */

const BUCKET = "provider-media";

export async function listMedia(providerId: string, listingId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("listing_media")
    .select("id, kind, storage_path, status, sort_order, created_at")
    .eq("listing_id", listingId)
    .order("sort_order");

  // Signed URLs, minted server-side, so the owner can preview private files.
  const withUrls = await Promise.all(
    (data ?? []).map(async (m) => {
      const { data: signed } = await supabase.storage
        .from(BUCKET)
        .createSignedUrl(m.storage_path, 60 * 60);
      return { ...m, url: signed?.signedUrl ?? null, providerId };
    }),
  );

  return withUrls;
}

/**
 * Uploads a file and records it. The path always begins with the provider id,
 * which is what the storage RLS policy checks — a provider cannot write into
 * another provider's folder.
 */
export async function uploadMedia(
  providerId: string,
  listingId: string,
  file: File,
): Promise<void> {
  const kind = file.type.startsWith("video/") ? "video" : "image";
  const ext = file.name.split(".").pop() ?? "bin";
  const path = `${providerId}/${listingId}/${crypto.randomUUID()}.${ext}`;

  const supabase = await createClient();

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { contentType: file.type, upsert: false });

  if (uploadError) throw new ProviderError(`Upload failed: ${uploadError.message}`);

  const { error: rowError } = await supabase.from("listing_media").insert({
    listing_id: listingId,
    kind,
    storage_path: path,
    // Forced to pending_approval by the trigger regardless; set for honesty.
    status: "pending_approval",
  });

  if (rowError) {
    // The row failed, so the orphaned file should not linger.
    await supabase.storage.from(BUCKET).remove([path]);
    throw new ProviderError(`Could not record the upload: ${rowError.message}`);
  }
}

export async function deleteMedia(providerId: string, mediaId: string): Promise<void> {
  const supabase = await createClient();

  const { data: media } = await supabase
    .from("listing_media")
    .select("storage_path, listings!inner ( provider_id )")
    .eq("id", mediaId)
    .maybeSingle();

  const owned =
    (media as unknown as { listings: { provider_id: string } } | null)?.listings
      ?.provider_id === providerId;
  if (!media || !owned) throw new ProviderError("That media does not exist");

  await supabase.storage.from(BUCKET).remove([media.storage_path]);
  await supabase.from("listing_media").delete().eq("id", mediaId);
}

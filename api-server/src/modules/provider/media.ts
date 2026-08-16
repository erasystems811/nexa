import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@nexa/db-types/src/types";
import { ProviderError } from "./context.js";

/** Listing media. Ported from apps/customer's modules/provider/media.ts — unchanged. Every upload enters Pending Approval. */

const BUCKET = "provider-media";

export async function listMedia(supabase: SupabaseClient<Database>, providerId: string, listingId: string) {
  const { data } = await supabase
    .from("listing_media")
    .select("id, kind, storage_path, status, sort_order, created_at")
    .eq("listing_id", listingId)
    .order("sort_order");

  const withUrls = await Promise.all(
    (data ?? []).map(async (m) => {
      const { data: signed } = await supabase.storage.from(BUCKET).createSignedUrl(m.storage_path, 60 * 60);
      return { ...m, url: signed?.signedUrl ?? null, providerId };
    }),
  );

  return withUrls;
}

export async function uploadMedia(
  supabase: SupabaseClient<Database>,
  providerId: string,
  listingId: string,
  file: File,
): Promise<void> {
  const kind = file.type.startsWith("video/") ? "video" : "image";
  const ext = file.name.split(".").pop() ?? "bin";
  const path = `${providerId}/${listingId}/${crypto.randomUUID()}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { contentType: file.type, upsert: false });

  if (uploadError) throw new ProviderError(`Upload failed: ${uploadError.message}`);

  const { error: rowError } = await supabase.from("listing_media").insert({
    listing_id: listingId,
    kind,
    storage_path: path,
    status: "pending_approval",
  });

  if (rowError) {
    await supabase.storage.from(BUCKET).remove([path]);
    throw new ProviderError(`Could not record the upload: ${rowError.message}`);
  }

  await supabase
    .from("listings")
    .update({ status: "pending_approval" })
    .eq("id", listingId)
    .eq("provider_id", providerId)
    .eq("status", "approved");
}

export async function deleteMedia(supabase: SupabaseClient<Database>, providerId: string, mediaId: string): Promise<void> {
  const { data: media } = await supabase
    .from("listing_media")
    .select("storage_path, listings!inner ( provider_id )")
    .eq("id", mediaId)
    .maybeSingle();

  const owned = (media as unknown as { listings: { provider_id: string } } | null)?.listings?.provider_id === providerId;
  if (!media || !owned) throw new ProviderError("That media does not exist");

  await supabase.storage.from(BUCKET).remove([media.storage_path]);
  await supabase.from("listing_media").delete().eq("id", mediaId);
}

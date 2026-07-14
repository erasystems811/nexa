import "server-only";

import { cache } from "react";
import { createAdminClient } from "@/lib/supabase/admin";
import { publicEnv } from "@/lib/env";

/**
 * The photo on a category tile.
 *
 * There is no column for it. The file is named after the category's own slug, so
 * the file *is* the record — nothing to keep in step, nothing to orphan, and
 * uploading a second time simply replaces the first.
 *
 * Read with the service role because the bucket's objects are listed through
 * RLS even when the bucket is public: an anonymous visitor can *fetch* the image
 * (that is what public means) but cannot enumerate the folder. Only names come
 * back here, and only on the server.
 *
 * `cache` makes this one call per request no matter how many components ask.
 */
export const BUCKET = "category-media";

export function categoryImageUrl(slug: string, version?: string): string {
  const base = `${publicEnv.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${slug}`;
  // A replaced photo keeps its path, so without this the browser would go on
  // showing the old one.
  return version ? `${base}?v=${encodeURIComponent(version)}` : base;
}

/** slug -> the URL of its photo. A category with no photo is simply absent. */
export const categoryImages = cache(async (): Promise<Record<string, string>> => {
  const db = createAdminClient();
  const { data, error } = await db.storage.from(BUCKET).list("", { limit: 200 });

  // A missing bucket or a storage hiccup must not take the homepage down with
  // it. No photos is a look Nexa already knows how to render.
  if (error || !data) return {};

  const out: Record<string, string> = {};
  for (const file of data) {
    if (file.name.startsWith(".")) continue;
    out[file.name] = categoryImageUrl(file.name, file.updated_at ?? undefined);
  }
  return out;
});

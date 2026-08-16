import { createAdminClient } from "../../supabase.js";
import { env } from "../../env.js";

/**
 * The photo on a category tile. Ported from apps/customer's
 * modules/marketplace/category-images.ts. No column for it — the file is
 * named after the category's own slug, so the file *is* the record.
 *
 * Read with the service role: an anonymous visitor can *fetch* a public
 * bucket's object, but cannot enumerate its folder without RLS letting them.
 */
export const BUCKET = "category-media";

export function categoryImageUrl(slug: string, version?: string): string {
  const base = `${env.SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${slug}`;
  return version ? `${base}?v=${encodeURIComponent(version)}` : base;
}

/** slug -> the URL of its photo. A category with no photo is simply absent. */
export async function categoryImages(): Promise<Record<string, string>> {
  const db = createAdminClient();
  const { data, error } = await db.storage.from(BUCKET).list("", { limit: 200 });

  if (error || !data) return {};

  const out: Record<string, string> = {};
  for (const file of data) {
    if (file.name.startsWith(".")) continue;
    out[file.name] = categoryImageUrl(file.name, file.updated_at ?? undefined);
  }
  return out;
}

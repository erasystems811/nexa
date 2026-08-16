import { adminDb, audit, AdminError } from "./context.js";
import { categoryImageUrl, CATEGORY_BUCKET } from "../marketplace/index.js";
import type { VendorTier } from "@nexa/db-types/src/types";

/**
 * The photo on a category tile.
 *
 * Stored at a path named after the category's slug, so uploading a second photo
 * for the same category simply replaces the first — there is no version to
 * clean up and no column to keep in step. See 0032.
 */

const ACCEPTED = ["image/jpeg", "image/png", "image/webp", "image/avif"];
const MAX_BYTES = 10 * 1024 * 1024;

export interface AdminCategory {
  id: string;
  name: string;
  slug: string;
  imageUrl: string | null;
  vendorTier: VendorTier;
}

/** Every category, with its photo if it has one. */
export async function listCategoriesForAdmin(): Promise<AdminCategory[]> {
  const db = adminDb();

  const [{ data: categories }, { data: files }] = await Promise.all([
    db.from("categories").select("id, name, slug, vendor_tier").eq("is_active", true).order("sort_order"),
    db.storage.from(CATEGORY_BUCKET).list("", { limit: 200 }),
  ]);

  const byslug = new Map(
    (files ?? []).map((f) => [f.name, f.updated_at ?? undefined] as const),
  );

  return (categories ?? []).map((c) => ({
    id: c.id,
    name: c.name,
    slug: c.slug,
    imageUrl: byslug.has(c.slug) ? categoryImageUrl(c.slug, byslug.get(c.slug)) : null,
    vendorTier: c.vendor_tier,
  }));
}

/**
 * Only self_serve changes behavior (see VENDOR_TIERS) — the vendor is invited
 * over WhatsApp with no booking or escrow. Retagging a category never touches
 * its existing listings' price/type; it only changes what a NEW listing under
 * it does going forward.
 */
export async function setCategoryVendorTier(actorId: string, categoryId: string, tier: VendorTier): Promise<void> {
  const db = adminDb();

  const { data: before } = await db.from("categories").select("vendor_tier").eq("id", categoryId).maybeSingle();
  if (!before) throw new AdminError("That category does not exist");

  const { error } = await db.from("categories").update({ vendor_tier: tier }).eq("id", categoryId);
  if (error) throw new AdminError(error.message);
  await audit(actorId, "set_category_vendor_tier", "category", categoryId, before, { vendor_tier: tier });
}

export async function setCategoryImage(
  actorId: string,
  slug: string,
  file: File,
): Promise<void> {
  if (!file || file.size === 0) throw new AdminError("Choose a photo");
  if (file.size > MAX_BYTES) throw new AdminError("That photo is too large. Keep it under 10MB");
  if (!ACCEPTED.includes(file.type)) {
    throw new AdminError("That is not a photo Nexa can use — send a JPG, PNG or WEBP");
  }

  const db = adminDb();

  const { data: category } = await db
    .from("categories")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();
  if (!category) throw new AdminError("That category does not exist");

  // upsert: the path is the slug, so a new photo lands on top of the old one.
  const { error } = await db.storage
    .from(CATEGORY_BUCKET)
    .upload(slug, file, { contentType: file.type, upsert: true });

  if (error) throw new AdminError(`Could not save the photo: ${error.message}`);
  await audit(actorId, "set_category_image", "category", category.id, null, { slug });
}

export async function removeCategoryImage(actorId: string, slug: string): Promise<void> {
  const db = adminDb();

  const { error } = await db.storage.from(CATEGORY_BUCKET).remove([slug]);
  if (error) throw new AdminError(`Could not remove the photo: ${error.message}`);

  // The tile falls back to its line icon, which is what it had before any of
  // this — so removing a photo is safe rather than destructive.
  await audit(actorId, "remove_category_image", "category", slug);
}

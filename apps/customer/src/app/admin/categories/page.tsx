import { requireView, listCategoriesForAdmin, PERMISSIONS as P } from "@/modules/admin";
import { removeCategoryImageAction } from "@/modules/admin/actions";
import { CategoryIcon } from "@/components/category-icon";
import { Card, CardContent } from "@/components/ui/card";
import { ActionButton } from "../action-button";
import { UploadPhoto } from "./upload-photo";
import { VendorTierSelect } from "./vendor-tier-select";

/**
 * The category tiles, and the photos on them.
 *
 * This is the first thing a customer looks at on Nexa, and until now nobody at
 * Nexa could change it. A category with no photo falls back to its line icon —
 * so the row never looks broken while it is being filled in.
 */
export default async function AdminCategoriesPage() {
  await requireView(P.settingsManage);
  const categories = await listCategoriesForAdmin();
  const withPhoto = categories.filter((c) => c.imageUrl).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="mb-2 text-3xl font-serif font-bold text-foreground">Categories</h1>
        <p className="text-muted-foreground">
          The tiles on the Nexa homepage. {withPhoto} of {categories.length} have a photo.
        </p>
      </div>

      <Card>
        <CardContent className="p-4">
          <p className="text-sm text-muted-foreground">
            A real photo sells a category — a decorated hall, a cake, a DJ booth under lights. Use a
            wide, well-lit picture; it is shown as a small square, so keep the subject in the middle.
            A category without a photo keeps its drawn icon, so nothing looks unfinished while you
            work through them.
          </p>
        </CardContent>
      </Card>

      <ul className="grid gap-3 sm:grid-cols-2">
        {categories.map((c) => (
          <li key={c.id}>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-start gap-4">
                  <div className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border bg-muted">
                    {c.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element -- Supabase storage, no loader configured
                      <img src={c.imageUrl} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <CategoryIcon slug={c.slug} className="size-7 text-muted-foreground" />
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-foreground">{c.name}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {c.imageUrl ? "Showing a photo" : "Showing the drawn icon"}
                    </p>

                    <div className="flex flex-wrap items-center gap-2">
                      <UploadPhoto slug={c.slug} hasPhoto={Boolean(c.imageUrl)} />
                      {c.imageUrl ? (
                        <div className="mt-3">
                          <ActionButton
                            label="Remove"
                            variant="danger"
                            confirm="Remove this photo? The category goes back to its drawn icon."
                            run={removeCategoryImageAction.bind(null, c.slug)}
                          />
                        </div>
                      ) : null}
                    </div>

                    <VendorTierSelect categoryId={c.id} value={c.vendorTier} />
                  </div>
                </div>
              </CardContent>
            </Card>
          </li>
        ))}
      </ul>
    </div>
  );
}

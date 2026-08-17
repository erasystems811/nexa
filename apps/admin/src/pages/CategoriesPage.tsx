import { useState, useTransition } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@nexa/design-system/src/components/ui/card";
import { apiSend } from "../lib/api";
import { useApiQuery } from "../lib/query";
import { useAuth } from "../auth/AuthContext";
import { PERMISSIONS as P, can } from "../lib/permissions";
import { ActionButton } from "../components/action-button";
import { UploadPhoto } from "../components/upload-photo";
import { CategoryIcon } from "../components/category-icon";
import { VENDOR_TIERS, VENDOR_TIER_LABELS, type VendorTier } from "@nexa/db-types/src/types";

interface AdminCategory {
  id: string;
  name: string;
  slug: string;
  imageUrl: string | null;
  vendorTier: VendorTier;
}

/** Only self_serve changes what happens at booking time — see VENDOR_TIERS. Retagging never touches existing listings. */
function VendorTierSelect({ categoryId, value, onChanged }: { categoryId: string; value: VendorTier; onChanged: () => void }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="mt-2">
      <select
        value={value}
        disabled={pending}
        onChange={(e) => {
          const tier = e.target.value as VendorTier;
          setError(null);
          start(async () => {
            try {
              await apiSend("POST", `/admin/categories/${categoryId}/vendor-tier`, { tier });
              onChanged();
            } catch (err) {
              setError(err instanceof Error ? err.message : "Could not save");
            }
          });
        }}
        className="h-8 w-full rounded-md border border-input bg-transparent px-2 text-xs shadow-sm outline-none focus-visible:ring-1 focus-visible:ring-ring"
      >
        {VENDOR_TIERS.map((t) => (
          <option key={t} value={t}>
            {VENDOR_TIER_LABELS[t]}
          </option>
        ))}
      </select>
      {error ? <p className="mt-1 text-xs text-destructive">{error}</p> : null}
    </div>
  );
}

/**
 * The category tiles, and the photos on them.
 *
 * This is the first thing a customer looks at on Nexa, and until now nobody at
 * Nexa could change it. A category with no photo falls back to its line icon —
 * so the row never looks broken while it is being filled in.
 */
export function CategoriesPage() {
  const { staff } = useAuth();
  const queryClient = useQueryClient();
  const queryKey = ["categories"] as const;
  const { data: categories } = useApiQuery<AdminCategory[]>(queryKey, "/admin/categories");
  const reload = () => queryClient.invalidateQueries({ queryKey });

  if (!can(staff, P.settingsManage)) {
    return <p className="text-sm text-muted-foreground">You do not have permission to manage categories.</p>;
  }

  if (!categories) {
    return <p className="text-sm text-muted-foreground">Loading…</p>;
  }

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
                      <UploadPhoto slug={c.slug} hasPhoto={Boolean(c.imageUrl)} onUploaded={reload} />
                      {c.imageUrl ? (
                        <div className="mt-3">
                          <ActionButton
                            label="Remove"
                            variant="danger"
                            confirm="Remove this photo? The category goes back to its drawn icon."
                            run={() => apiSend("DELETE", `/admin/categories/${c.slug}/image`).then(reload)}
                          />
                        </div>
                      ) : null}
                    </div>

                    <VendorTierSelect categoryId={c.id} value={c.vendorTier} onChanged={reload} />
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

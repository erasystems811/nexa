"use client";

import { useState, useTransition } from "react";
import { setCategoryVendorTierAction } from "@/modules/admin/actions";
import { VENDOR_TIERS, VENDOR_TIER_LABELS } from "@/lib/db/types";
import type { VendorTier } from "@/lib/db/types";

/**
 * Only self_serve changes what happens at booking time — see VENDOR_TIERS.
 * Retagging a category never touches its existing listings.
 */
export function VendorTierSelect({ categoryId, value }: { categoryId: string; value: VendorTier }) {
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
              await setCategoryVendorTierAction(categoryId, tier);
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

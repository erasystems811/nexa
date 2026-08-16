"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { FormState } from "@/modules/provider/actions";

interface Category {
  id: string;
  name: string;
  fulfillment_type: string;
}

interface Defaults {
  title?: string;
  category_id?: string;
  description?: string;
  price_type?: "fixed" | "negotiable";
  price?: number;
  price_min?: number;
  price_max?: number;
  caution_fee?: number;
}

const selectClass =
  "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";

/**
 * Create and edit share this form. A listing declares a price type — Fixed, or
 * Negotiable, which means the customer chats first and the two of you agree a
 * number.
 *
 * There is no deposit to choose. The customer pays, Nexa holds the whole amount,
 * and Nexa pays the vendor once the job is done.
 */
export function ListingForm({
  categories,
  action,
  defaults = {},
  submitLabel,
  showPhotos = false,
  confirmOnSave,
  negotiableEnabled = true,
}: {
  categories: Category[];
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  defaults?: Defaults;
  submitLabel: string;
  /** Create shows a photo picker so the listing arrives with its pictures. */
  showPhotos?: boolean;
  /** When set, the vendor must confirm this before the form submits — used on a
   *  live listing, where saving takes it offline for re-approval. */
  confirmOnSave?: string;
  /** The real gate is server-side (readListingForm); this only decides whether
   *  the option is offered. A listing already negotiable stays choosable even
   *  when off, so turning the flag off never silently changes an existing one. */
  negotiableEnabled?: boolean;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const [priceType, setPriceType] = useState(defaults.price_type ?? "fixed");
  const priceTypeOptions =
    negotiableEnabled || defaults.price_type === "negotiable"
      ? (["fixed", "negotiable"] as const)
      : (["fixed"] as const);
  const [categoryId, setCategoryId] = useState(defaults.category_id ?? categories[0]?.id ?? "");

  const category = categories.find((c) => c.id === categoryId);
  const isRental = category?.fulfillment_type === "delivery_return";

  return (
    <form action={formAction} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="title">Title</Label>
        <Input id="title" name="title" defaultValue={defaults.title} required />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="category_id">Category</Label>
        <select
          id="category_id"
          name="category_id"
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
          className={selectClass}
        >
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="description">Description</Label>
        <Textarea id="description" name="description" defaultValue={defaults.description} rows={3} />
      </div>

      <fieldset>
        <span className="mb-1.5 block text-sm font-medium">Price type</span>
        <div className="flex gap-2">
          {priceTypeOptions.map((t) => (
            <label
              key={t}
              className={cn(
                "flex-1 cursor-pointer rounded-md border px-4 py-3 text-center text-sm transition-colors",
                priceType === t ? "border-primary bg-primary/5 font-medium text-primary" : "border-input",
              )}
            >
              <input
                type="radio"
                name="price_type"
                value={t}
                checked={priceType === t}
                onChange={() => setPriceType(t)}
                className="sr-only"
              />
              {t === "fixed" ? "Fixed price" : "Negotiable"}
            </label>
          ))}
        </div>
      </fieldset>

      {priceType === "fixed" ? (
        <div className="space-y-1.5">
          <Label htmlFor="price">Price (₦)</Label>
          <Input id="price" name="price" type="number" min="0" step="any" defaultValue={defaults.price} />
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="price_min">From (₦)</Label>
            <Input id="price_min" name="price_min" type="number" min="0" step="any" defaultValue={defaults.price_min} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="price_max">To (₦)</Label>
            <Input id="price_max" name="price_max" type="number" min="0" step="any" defaultValue={defaults.price_max} />
          </div>
        </div>
      )}

      {isRental ? (
        <div className="space-y-1.5">
          <Label htmlFor="caution_fee">Caution fee (₦)</Label>
          <Input
            id="caution_fee"
            name="caution_fee"
            type="number"
            min="0"
            step="any"
            defaultValue={defaults.caution_fee}
          />
          <p className="text-xs text-muted-foreground">
            Held separately on rentals and refunded when items come back in good condition.
          </p>
        </div>
      ) : null}

      {showPhotos ? (
        <div className="space-y-1.5">
          <Label htmlFor="photos">Photos</Label>
          <input
            id="photos"
            type="file"
            name="photos"
            accept="image/jpeg,image/png,image/webp,image/avif"
            multiple
            className="w-full rounded-md border border-input bg-transparent p-3 text-sm file:mr-3 file:rounded-full file:border-0 file:bg-secondary file:px-4 file:py-2 file:text-sm file:text-secondary-foreground"
          />
          <p className="text-xs text-muted-foreground">
            Add at least one clear photo of your service. JPG, PNG or WEBP, under 10MB each. They go
            to Admin with the listing.
          </p>
        </div>
      ) : null}

      {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
      {state.ok ? (
        <p className="text-sm text-emerald-700">Saved. It goes to Admin for approval before it&rsquo;s public.</p>
      ) : null}

      <Button
        type="submit"
        className="w-full"
        disabled={pending}
        onClick={(e) => {
          if (confirmOnSave && !window.confirm(confirmOnSave)) e.preventDefault();
        }}
      >
        {pending ? "Saving…" : submitLabel}
      </Button>
      <p className="text-center text-xs text-muted-foreground">
        Every listing, and every edit to price or details, is reviewed by Admin before going live.
      </p>
    </form>
  );
}

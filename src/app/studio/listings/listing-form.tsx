"use client";

import { useActionState, useState } from "react";
import { Alert, Button, Field } from "@/components/ui";
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
      <Field label="Title" name="title" defaultValue={defaults.title} required />

      <label className="block">
        <span className="mb-1.5 block text-sm font-medium">Category</span>
        <select
          name="category_id"
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
          className="h-12 w-full rounded-xl border border-[color:var(--color-line)] bg-white px-4"
        >
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </label>

      <label className="block">
        <span className="mb-1.5 block text-sm font-medium">Description</span>
        <textarea
          name="description"
          defaultValue={defaults.description}
          rows={3}
          className="w-full rounded-xl border border-[color:var(--color-line)] bg-white px-4 py-3 text-sm"
        />
      </label>

      <fieldset>
        <span className="mb-1.5 block text-sm font-medium">Price type</span>
        <div className="flex gap-2">
          {priceTypeOptions.map((t) => (
            <label
              key={t}
              className={`flex-1 cursor-pointer rounded-xl border px-4 py-3 text-center text-sm ${priceType === t ? "border-[color:var(--color-ink)] font-medium" : "border-[color:var(--color-line)]"}`}
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
        <Field label="Price (₦)" name="price" type="number" min="0" step="any" defaultValue={defaults.price} />
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <Field label="From (₦)" name="price_min" type="number" min="0" step="any" defaultValue={defaults.price_min} />
          <Field label="To (₦)" name="price_max" type="number" min="0" step="any" defaultValue={defaults.price_max} />
        </div>
      )}

      {isRental ? (
        <Field
          label="Caution fee (₦)"
          name="caution_fee"
          type="number"
          min="0"
          step="any"
          defaultValue={defaults.caution_fee}
          hint="Held separately on rentals and refunded when items come back in good condition."
        />
      ) : null}

      {showPhotos ? (
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium">Photos</span>
          <input
            type="file"
            name="photos"
            accept="image/jpeg,image/png,image/webp,image/avif"
            multiple
            className="w-full rounded-xl border border-[color:var(--color-line)] bg-white p-3 text-sm file:mr-3 file:rounded-full file:border-0 file:bg-[color:var(--color-surface-sunk)] file:px-4 file:py-2 file:text-sm"
          />
          <span className="mt-1 block text-xs text-[color:var(--color-ink-muted)]">
            Add at least one clear photo of your service. JPG, PNG or WEBP, under 10MB each. They go
            to Admin with the listing.
          </span>
        </label>
      ) : null}

      {state.error ? <Alert>{state.error}</Alert> : null}
      {state.ok ? <Alert tone="success">Saved. It goes to Admin for approval before it&rsquo;s public.</Alert> : null}

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
      <p className="text-center text-xs text-[color:var(--color-ink-muted)]">
        Every listing, and every edit to price or details, is reviewed by Admin before going live.
      </p>
    </form>
  );
}

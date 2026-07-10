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
  payment_type?: "full" | "deposit";
  price?: number;
  price_min?: number;
  price_max?: number;
  caution_fee?: number;
}

/**
 * Create and edit share this form. PRD Section 06/08: a listing declares both a
 * payment type (full or deposit) and a price type (Fixed or Negotiable).
 *
 * The deposit *percentage* is not here — it is set per provider by Admin on the
 * agreement (Section 05, 10). A "deposit" listing uses that agreed percentage.
 */
export function ListingForm({
  categories,
  action,
  defaults = {},
  submitLabel,
}: {
  categories: Category[];
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  defaults?: Defaults;
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const [priceType, setPriceType] = useState(defaults.price_type ?? "fixed");
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
          {(["fixed", "negotiable"] as const).map((t) => (
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

      <label className="block">
        <span className="mb-1.5 block text-sm font-medium">Payment type</span>
        <select
          name="payment_type"
          defaultValue={defaults.payment_type ?? "full"}
          className="h-12 w-full rounded-xl border border-[color:var(--color-line)] bg-white px-4"
        >
          <option value="full">Full payment</option>
          <option value="deposit">Deposit (percentage set by Admin)</option>
        </select>
      </label>

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

      {state.error ? <Alert>{state.error}</Alert> : null}
      {state.ok ? <Alert tone="success">Saved. It goes to Admin for approval before it&rsquo;s public.</Alert> : null}

      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Saving…" : submitLabel}
      </Button>
      <p className="text-center text-xs text-[color:var(--color-ink-muted)]">
        Every listing, and every edit to price or details, is reviewed by Admin before going live.
      </p>
    </form>
  );
}

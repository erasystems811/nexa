import { useState, type FormEvent } from "react";
import clsx from "clsx";
import type { Category, Listing, PaymentType } from "@nexa/db-types/src/types";
import { nairaToKobo, koboToNaira } from "@nexa/money";
import { Button } from "@nexa/design-system/src/components/ui/button";
import { Input } from "@nexa/design-system/src/components/ui/input";
import { Label } from "@nexa/design-system/src/components/ui/label";
import { Textarea } from "@nexa/design-system/src/components/ui/textarea";
import { apiSend, apiUpload, ApiError } from "../lib/api";

interface ListingInput {
  title: string;
  categoryId: string;
  description?: string;
  priceType: "fixed" | "negotiable";
  paymentType: PaymentType;
  priceKobo?: number | null;
  priceMinKobo?: number | null;
  priceMaxKobo?: number | null;
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
  listing,
  submitLabel,
  showPhotos = false,
  confirmOnSave,
  negotiableEnabled = true,
  onSaved,
}: {
  categories: Category[];
  /** Omitted on create; present on edit — its fields seed the form. */
  listing?: Listing;
  submitLabel: string;
  /** Create shows a photo picker so the listing arrives with its pictures. */
  showPhotos?: boolean;
  /** When set, the vendor must confirm this before the form submits — used on a
   *  live listing, where saving takes it offline for re-approval. */
  confirmOnSave?: string;
  /** The real gate is server-side; this only decides whether the option is
   *  offered. A listing already negotiable stays choosable even when off, so
   *  turning the flag off never silently changes an existing one. */
  negotiableEnabled?: boolean;
  /** Called with the listing id after a successful create or save. */
  onSaved?: (id: string) => void;
}) {
  const [priceType, setPriceType] = useState<"fixed" | "negotiable">(listing?.price_type ?? "fixed");
  const [categoryId, setCategoryId] = useState(listing?.category_id ?? categories[0]?.id ?? "");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  const priceTypeOptions =
    negotiableEnabled || listing?.price_type === "negotiable"
      ? (["fixed", "negotiable"] as const)
      : (["fixed"] as const);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (confirmOnSave && !window.confirm(confirmOnSave)) return;

    const form = new FormData(e.currentTarget);
    const toKobo = (name: string) => {
      const v = form.get(name);
      return v ? nairaToKobo(Number(v)) : null;
    };
    const input: ListingInput = {
      title: String(form.get("title") ?? ""),
      categoryId,
      description: String(form.get("description") ?? "") || undefined,
      priceType,
      // No deposit choice exists — Nexa holds the whole amount, so every
      // listing is written as "full". The column survives only because the
      // schema isn't ours to change (see the original actions.ts note).
      paymentType: "full" as PaymentType,
      priceKobo: toKobo("price"),
      priceMinKobo: toKobo("price_min"),
      priceMaxKobo: toKobo("price_max"),
    };

    setPending(true);
    setError(null);
    setOk(false);
    try {
      let id: string;
      if (listing) {
        await apiSend("PATCH", `/provider/listings/${listing.id}`, input);
        id = listing.id;
      } else {
        const res = await apiSend<{ id: string }>("POST", "/provider/listings", input);
        id = res.id;
      }

      if (showPhotos) {
        const photos = form.getAll("photos").filter((f): f is File => f instanceof File && f.size > 0);
        for (const photo of photos) {
          await apiUpload(`/provider/listings/${id}/media`, photo);
        }
      }

      setOk(true);
      onSaved?.(id);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="title">Title</Label>
        <Input id="title" name="title" defaultValue={listing?.title} required />
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
        <Textarea id="description" name="description" defaultValue={listing?.description ?? undefined} rows={3} />
      </div>

      <fieldset>
        <span className="mb-1.5 block text-sm font-medium">Price type</span>
        <div className="flex gap-2">
          {priceTypeOptions.map((t) => (
            <label
              key={t}
              className={clsx(
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
          <Input
            id="price"
            name="price"
            type="number"
            min="0"
            step="any"
            defaultValue={listing?.price_kobo ? koboToNaira(listing.price_kobo) : undefined}
          />
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="price_min">From (₦)</Label>
            <Input
              id="price_min"
              name="price_min"
              type="number"
              min="0"
              step="any"
              defaultValue={listing?.price_min_kobo ? koboToNaira(listing.price_min_kobo) : undefined}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="price_max">To (₦)</Label>
            <Input
              id="price_max"
              name="price_max"
              type="number"
              min="0"
              step="any"
              defaultValue={listing?.price_max_kobo ? koboToNaira(listing.price_max_kobo) : undefined}
            />
          </div>
        </div>
      )}

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

      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {ok ? (
        <p className="text-sm text-emerald-700">Saved. It goes to Admin for approval before it&rsquo;s public.</p>
      ) : null}

      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Saving…" : submitLabel}
      </Button>
      <p className="text-center text-xs text-muted-foreground">
        Every listing, and every edit to price or details, is reviewed by Admin before going live.
      </p>
    </form>
  );
}

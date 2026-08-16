"use client";

import Link from "next/link";
import { useActionState, useRef, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { applyAction, type ApplyState } from "./actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Option {
  id: string;
  name: string;
}

interface IdTypeOption {
  value: string;
  label: string;
  /** A CAC certificate is a document, not a number. Nothing to type in. */
  needsNumber: boolean;
}

const initialState: ApplyState = {};

/**
 * Everything Nexa needs to decide whether a business is real, on one screen.
 * Categories and cities come from the database — Nexa never hardcodes either.
 */
export function ApplyForm({
  categories,
  cities,
  idTypes,
  acceptedMimeTypes,
  vendorLoginUrl,
}: {
  categories: Option[];
  cities: Option[];
  idTypes: IdTypeOption[];
  acceptedMimeTypes: string[];
  /** Absolute, and on the vendor domain. */
  vendorLoginUrl: string;
}) {
  const [state, action, pending] = useActionState(applyAction, initialState);
  const [showPassword, setShowPassword] = useState(false);

  if (state.submitted) {
    return (
      <Card>
        <CardContent className="pt-6">
          <h2 className="text-lg font-semibold">Application received</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Someone at Nexa will look at your business and the identification you sent, and email{" "}
            <span className="font-medium text-foreground">{state.email}</span> with the decision.
          </p>
          <p className="mt-3 text-sm text-muted-foreground">
            You can sign in with the password you just chose to check on it at any time. The
            moment you are approved, Business Studio opens and you can build your listings.
          </p>
          <a href={vendorLoginUrl} className="mt-5 block">
            <Button className="w-full">Sign in to Nexa for vendors</Button>
          </a>
          <Link href="/" className="mt-3 block">
            <Button variant="ghost" className="w-full">
              Back to Nexa
            </Button>
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <form action={action} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="business_name">Business name</Label>
        <Input id="business_name" name="business_name" required />
      </div>

      <div className="space-y-2">
        <Label htmlFor="phone">Phone number</Label>
        <Input id="phone" name="phone" type="tel" required />
      </div>

      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" required />
        <p className="text-xs text-muted-foreground">This is what you sign in with.</p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="password">Choose a password</Label>
        <div className="relative">
          <Input
            id="password"
            name="password"
            type={showPassword ? "text" : "password"}
            required
            minLength={8}
            className="pr-9"
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            aria-label={showPassword ? "Hide password" : "Show password"}
            className="absolute inset-y-0 right-0 flex w-9 items-center justify-center text-muted-foreground hover:text-foreground"
          >
            {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        </div>
        <p className="text-xs text-muted-foreground">
          At least 8 characters. You can sign in straight away and check on your application.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="city_id">City</Label>
        <Select name="city_id" required>
          <SelectTrigger id="city_id">
            <SelectValue placeholder="Choose a city" />
          </SelectTrigger>
          <SelectContent>
            {cities.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="area">Area</Label>
        <Input id="area" name="area" required placeholder="e.g. Wuse, Maitama, Ide" />
        <p className="text-xs text-muted-foreground">
          Just the area, so customers nearby can find you — not your street or house number.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">About your business</Label>
        <Textarea
          id="description"
          name="description"
          rows={4}
          required
          placeholder="What you do, how long you have been doing it, the kind of events you cover."
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="profile_photo">Profile photo</Label>
        <Input
          id="profile_photo"
          type="file"
          name="profile_photo"
          accept="image/jpeg,image/png,image/webp,image/avif"
          required
        />
        <p className="text-xs text-muted-foreground">
          Your business&rsquo;s face on Nexa — a logo or a clear photo. JPG, PNG or WEBP, under 10MB.
        </p>
      </div>

      <ListingsFieldset categories={categories} />

      <div className="rounded-md bg-secondary p-4">
        <p className="text-sm font-medium text-secondary-foreground">Two means of identification</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Nexa checks who every vendor is before they can take a booking — it is why customers trust
          the vendors here. Send two different ones. Only Nexa ever sees them.
        </p>
      </div>

      <IdFieldset n={1} idTypes={idTypes} acceptedMimeTypes={acceptedMimeTypes} />
      <IdFieldset n={2} idTypes={idTypes} acceptedMimeTypes={acceptedMimeTypes} />

      {state.error ? <p className="text-sm font-medium text-destructive">{state.error}</p> : null}

      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Sending your application…" : "Apply to become a vendor"}
      </Button>
      <p className="text-center text-xs text-muted-foreground">
        One review covers everything here — your business, what you sell, and your ID. Approval
        puts it all live at once.
      </p>
      <p className="text-center text-xs text-muted-foreground">
        Nexa reviews every application. You will hear from us by email.
      </p>
    </form>
  );
}

/** One means of identification. The form asks for two, numbered from 1. */
function IdFieldset({
  n,
  idTypes,
  acceptedMimeTypes,
}: {
  n: number;
  idTypes: IdTypeOption[];
  acceptedMimeTypes: string[];
}) {
  const [chosen, setChosen] = useState("");
  const needsNumber = idTypes.find((t) => t.value === chosen)?.needsNumber ?? true;

  return (
    <fieldset className="space-y-4 rounded-md border border-border p-4">
      <legend className="px-1 text-sm font-medium">ID {n}</legend>

      <div className="space-y-2">
        <Label htmlFor={`id_type_${n}`}>Type</Label>
        <Select name={`id_type_${n}`} required value={chosen} onValueChange={setChosen}>
          <SelectTrigger id={`id_type_${n}`}>
            <SelectValue placeholder="Choose one" />
          </SelectTrigger>
          <SelectContent>
            {idTypes.map((t) => (
              <SelectItem key={t.value} value={t.value}>
                {t.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {needsNumber ? (
        <div className="space-y-2">
          <Label htmlFor={`id_number_${n}`}>ID number</Label>
          <Input id={`id_number_${n}`} name={`id_number_${n}`} required />
        </div>
      ) : null}

      <div className="space-y-2">
        <Label htmlFor={`id_file_${n}`}>Photo of the ID</Label>
        <Input
          id={`id_file_${n}`}
          type="file"
          name={`id_file_${n}`}
          required
          accept={acceptedMimeTypes.join(",")}
        />
        <p className="text-xs text-muted-foreground">A clear photo or scan. JPG, PNG or WEBP, under 10MB.</p>
      </div>
    </fieldset>
  );
}

/**
 * What they're selling, submitted with the application itself — not added
 * later in Business Studio. Admin reviews the business, the listings, and the
 * ID together and approves once; nothing here waits in a second queue.
 */
function ListingsFieldset({ categories }: { categories: Option[] }) {
  // Keys, not a count: React needs a stable identity per row so removing row
  // 1 doesn't reindex row 2's uncontrolled file/text inputs and silently
  // discard what was typed into them.
  const [rows, setRows] = useState([0]);
  const nextKey = useRef(1);
  // Fixed vs negotiable per row — a vendor who doesn't have a set price
  // (e.g. it depends on guest count, or they just want to chat about it)
  // shouldn't be forced to type a number to apply.
  const [priceTypes, setPriceTypes] = useState<Record<number, "fixed" | "negotiable">>({});

  return (
    <div className="space-y-3">
      <div>
        <p className="text-sm font-medium">What are you selling?</p>
        <p className="text-xs text-muted-foreground">
          At least one, each with its own category, a price, and a photo — a vendor can sell across
          several categories, so this is chosen per item, not once for the whole business.
        </p>
      </div>

      <input type="hidden" name="listing_keys" value={rows.join(",")} />

      {rows.map((key, i) => (
        <fieldset key={key} className="space-y-4 rounded-md border border-border p-4">
          <legend className="px-1 text-sm font-medium">Item {i + 1}</legend>

          <div className="space-y-2">
            <Label htmlFor={`listing_title_${key}`}>Title</Label>
            <Input
              id={`listing_title_${key}`}
              name={`listing_title_${key}`}
              required
              placeholder="e.g. Small chops platter, DJ for a wedding"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor={`listing_category_${key}`}>Category</Label>
            <Select name={`listing_category_${key}`} required>
              <SelectTrigger id={`listing_category_${key}`}>
                <SelectValue placeholder="Choose a category" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <span className="text-sm font-medium">Price</span>
            <div className="flex gap-2">
              {(["fixed", "negotiable"] as const).map((t) => {
                const active = (priceTypes[key] ?? "fixed") === t;
                return (
                  <label
                    key={t}
                    className={`flex-1 cursor-pointer rounded-md border px-4 py-2 text-center text-sm transition-colors ${
                      active ? "border-primary bg-primary/5 font-medium text-primary" : "border-input"
                    }`}
                  >
                    <input
                      type="radio"
                      name={`listing_price_type_${key}`}
                      value={t}
                      checked={active}
                      onChange={() => setPriceTypes((p) => ({ ...p, [key]: t }))}
                      className="sr-only"
                    />
                    {t === "fixed" ? "Fixed price" : "Negotiable"}
                  </label>
                );
              })}
            </div>
          </div>

          {(priceTypes[key] ?? "fixed") === "fixed" ? (
            <div className="space-y-2">
              <Label htmlFor={`listing_price_${key}`}>Price (₦)</Label>
              <Input
                id={`listing_price_${key}`}
                name={`listing_price_${key}`}
                type="number"
                min="0"
                step="any"
                required
              />
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              No price needed — customers chat with you first and you agree a number.
            </p>
          )}

          <div className="space-y-2">
            <Label htmlFor={`listing_photo_${key}`}>Photo</Label>
            <Input
              id={`listing_photo_${key}`}
              type="file"
              name={`listing_photo_${key}`}
              accept="image/jpeg,image/png,image/webp,image/avif"
              required
            />
          </div>

          {rows.length > 1 ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-muted-foreground hover:text-destructive"
              onClick={() => setRows((r) => r.filter((k) => k !== key))}
            >
              Remove this item
            </Button>
          ) : null}
        </fieldset>
      ))}

      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => {
          setRows((r) => [...r, nextKey.current]);
          nextKey.current += 1;
        }}
      >
        + Add another item
      </Button>
    </div>
  );
}

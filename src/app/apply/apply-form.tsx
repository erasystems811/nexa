"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { applyAction, type ApplyState } from "./actions";
import { Alert, Button, Card, Field } from "@/components/ui";

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
}: {
  categories: Option[];
  cities: Option[];
  idTypes: IdTypeOption[];
  acceptedMimeTypes: string[];
}) {
  const [state, action, pending] = useActionState(applyAction, initialState);

  if (state.submitted) {
    return (
      <Card>
        <h2 className="text-lg font-semibold">Application received</h2>
        <p className="mt-2 text-sm text-[color:var(--color-ink-muted)]">
          Someone at Nexa will look at your business and the identification you sent, and email{" "}
          <span className="font-medium text-[color:var(--color-ink)]">{state.email}</span> with the
          decision.
        </p>
        <p className="mt-3 text-sm text-[color:var(--color-ink-muted)]">
          You can sign in with the password you just chose to check on it at any time. The moment
          you are approved, Business Studio opens and you can build your listings.
        </p>
        <Link href="/login" className="mt-5 block">
          <Button className="w-full">Sign in</Button>
        </Link>
        <Link href="/" className="mt-3 block">
          <Button variant="ghost" className="w-full">
            Back to Nexa
          </Button>
        </Link>
      </Card>
    );
  }

  return (
    <form action={action} className="space-y-4">
      <Field label="Business name" name="business_name" required />
      <Field
        label="Phone number"
        name="phone"
        type="tel"
        required
        hint="Customers never see this. Nexa uses it to reach you."
      />
      <Field
        label="Email"
        name="email"
        type="email"
        required
        hint="This is what you sign in with."
      />
      <Field
        label="Choose a password"
        name="password"
        type="password"
        required
        minLength={8}
        hint="At least 8 characters. You can sign in straight away and check on your application."
      />

      <label className="block">
        <span className="mb-1.5 block text-sm font-medium">What service do you offer?</span>
        <select
          name="category_id"
          required
          defaultValue=""
          className="h-12 w-full rounded-xl border border-[color:var(--color-line)] bg-white px-4"
        >
          <option value="" disabled>
            Choose a service
          </option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </label>

      <label className="block">
        <span className="mb-1.5 block text-sm font-medium">City</span>
        <select
          name="city_id"
          required
          defaultValue=""
          className="h-12 w-full rounded-xl border border-[color:var(--color-line)] bg-white px-4"
        >
          <option value="" disabled>
            Choose a city
          </option>
          {cities.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </label>

      <label className="block">
        <span className="mb-1.5 block text-sm font-medium">About your business</span>
        <textarea
          name="description"
          rows={4}
          required
          placeholder="What you do, how long you have been doing it, the kind of events you cover."
          className="w-full rounded-xl border border-[color:var(--color-line)] bg-white px-4 py-3 text-sm"
        />
      </label>

      <div className="rounded-[var(--radius-card)] bg-[color:var(--color-surface-sunk)] p-4">
        <p className="text-sm font-medium">Two means of identification</p>
        <p className="mt-1 text-xs text-[color:var(--color-ink-muted)]">
          Nexa checks who every vendor is before they can take a booking — it is why customers trust
          the vendors here. Send two different ones. Only Nexa ever sees them.
        </p>
      </div>

      <IdFieldset
        n={1}
        idTypes={idTypes}
        acceptedMimeTypes={acceptedMimeTypes}
      />
      <IdFieldset
        n={2}
        idTypes={idTypes}
        acceptedMimeTypes={acceptedMimeTypes}
      />

      {state.error ? <Alert>{state.error}</Alert> : null}

      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Sending your application…" : "Apply to become a vendor"}
      </Button>
      <p className="text-center text-xs text-[color:var(--color-ink-muted)]">
        Nexa reviews every application by hand. You will hear from us by email.
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
    <fieldset className="space-y-4 rounded-[var(--radius-card)] border border-[color:var(--color-line)] p-4">
      <legend className="px-1 text-sm font-medium">ID {n}</legend>

      <label className="block">
        <span className="mb-1.5 block text-sm font-medium">Type</span>
        <select
          name={`id_type_${n}`}
          required
          value={chosen}
          onChange={(e) => setChosen(e.target.value)}
          className="h-12 w-full rounded-xl border border-[color:var(--color-line)] bg-white px-4"
        >
          <option value="" disabled>
            Choose one
          </option>
          {idTypes.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </label>

      {needsNumber ? <Field label="ID number" name={`id_number_${n}`} required /> : null}

      <label className="block">
        <span className="mb-1.5 block text-sm font-medium">Photo of the ID</span>
        <input
          type="file"
          name={`id_file_${n}`}
          required
          accept={acceptedMimeTypes.join(",")}
          className="w-full rounded-xl border border-[color:var(--color-line)] bg-white p-3 text-sm file:mr-3 file:rounded-full file:border-0 file:bg-[color:var(--color-surface-sunk)] file:px-4 file:py-2 file:text-sm"
        />
        <span className="mt-1 block text-xs text-[color:var(--color-ink-muted)]">
          A clear photo or scan. JPG, PNG or WEBP, under 10MB.
        </span>
      </label>
    </fieldset>
  );
}

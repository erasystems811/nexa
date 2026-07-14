"use client";

import { useActionState } from "react";
import { submitIdDocumentAction } from "@/modules/provider/actions";
import type { FormState } from "@/modules/provider/actions";
import { Alert, Button, Field } from "@/components/ui";

const initialState: FormState = {};

interface IdTypeOption {
  value: string;
  label: string;
}

/**
 * One document at a time. A vendor sends what they have, and comes back with the
 * second when they have it — asking for both in one go would turn away the
 * business whose CAC certificate is at home.
 */
export function VerifyForm({
  remainingTypes,
  acceptedMimeTypes,
}: {
  remainingTypes: IdTypeOption[];
  acceptedMimeTypes: string[];
}) {
  const [state, action, pending] = useActionState(submitIdDocumentAction, initialState);

  if (remainingTypes.length === 0) {
    return (
      <p className="text-sm text-[color:var(--color-ink-muted)]">
        You have sent Nexa every kind of ID we accept. Nothing more is needed from you.
      </p>
    );
  }

  return (
    <form action={action} className="space-y-4">
      <label className="block">
        <span className="mb-1.5 block text-sm font-medium">Which ID is this?</span>
        <select
          name="id_type"
          required
          defaultValue=""
          className="h-12 w-full rounded-xl border border-[color:var(--color-line)] bg-white px-4"
        >
          <option value="" disabled>
            Choose one
          </option>
          {remainingTypes.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </label>

      <Field label="The number on it" name="id_number" required />

      <label className="block">
        <span className="mb-1.5 block text-sm font-medium">Photo of it</span>
        <input
          type="file"
          name="id_file"
          required
          accept={acceptedMimeTypes.join(",")}
          className="w-full rounded-xl border border-[color:var(--color-line)] bg-white p-3 text-sm file:mr-3 file:rounded-full file:border-0 file:bg-[color:var(--color-surface-sunk)] file:px-4 file:py-2 file:text-sm"
        />
        <span className="mt-1 block text-xs text-[color:var(--color-ink-muted)]">
          A clear photo or scan. JPG, PNG or WEBP, under 10MB.
        </span>
      </label>

      {state.error ? <Alert>{state.error}</Alert> : null}
      {state.ok ? <Alert tone="success">Sent. Nexa will look at it.</Alert> : null}

      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Sending…" : "Send this to Nexa"}
      </Button>
    </form>
  );
}

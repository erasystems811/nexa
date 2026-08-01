"use client";

import { useActionState, useState } from "react";
import { submitIdDocumentAction } from "@/modules/provider/actions";
import type { FormState } from "@/modules/provider/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initialState: FormState = {};

interface IdTypeOption {
  value: string;
  label: string;
  /** A CAC certificate is a document, not a number. Nothing to type in. */
  needsNumber: boolean;
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
  const [chosen, setChosen] = useState("");
  const needsNumber = remainingTypes.find((t) => t.value === chosen)?.needsNumber ?? true;

  if (remainingTypes.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        You have sent Nexa every kind of ID we accept. Nothing more is needed from you.
      </p>
    );
  }

  return (
    <form action={action} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="id_type">Which ID is this?</Label>
        <select
          id="id_type"
          name="id_type"
          required
          value={chosen}
          onChange={(e) => setChosen(e.target.value)}
          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm outline-none focus-visible:ring-1 focus-visible:ring-ring"
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
      </div>

      {needsNumber ? (
        <div className="space-y-1.5">
          <Label htmlFor="id_number">The number on it</Label>
          <Input id="id_number" name="id_number" required />
        </div>
      ) : null}

      <div className="space-y-1.5">
        <Label htmlFor="id_file">Photo of it</Label>
        <input
          id="id_file"
          type="file"
          name="id_file"
          required
          accept={acceptedMimeTypes.join(",")}
          className="flex w-full rounded-md border border-input bg-transparent p-2.5 text-sm file:mr-3 file:rounded-full file:border-0 file:bg-secondary file:px-4 file:py-2 file:text-sm"
        />
        <span className="block text-xs text-muted-foreground">A clear photo or scan. JPG, PNG or WEBP, under 10MB.</span>
      </div>

      {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
      {state.ok ? <p className="text-sm text-emerald-700">Sent. Nexa will look at it.</p> : null}

      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Sending…" : "Send this to Nexa"}
      </Button>
    </form>
  );
}

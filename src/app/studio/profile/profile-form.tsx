"use client";

import { useActionState } from "react";
import { saveProfileAction, type FormState } from "@/modules/provider/actions";
import { Alert, Button, Field } from "@/components/ui";

/**
 * PRD Section 08/16: contact details are collected but never shown to customers
 * — Nexa masks them. That is why the phone/email fields carry the note they do.
 */
export function ProfileForm({
  defaults,
}: {
  defaults: {
    business_name: string;
    description: string;
    address: string;
    contact_phone: string;
    contact_email: string;
  };
}) {
  const [state, action, pending] = useActionState(saveProfileAction, {} as FormState);

  return (
    <form action={action} className="space-y-4">
      <Field label="Business name" name="business_name" defaultValue={defaults.business_name} required />

      <label className="block">
        <span className="mb-1.5 block text-sm font-medium">Description</span>
        <textarea
          name="description"
          defaultValue={defaults.description}
          rows={3}
          className="w-full rounded-xl border border-[color:var(--color-line)] bg-white px-4 py-3 text-sm"
        />
      </label>

      <Field label="Location" name="address" defaultValue={defaults.address} />

      <Field
        label="Contact phone"
        name="contact_phone"
        type="tel"
        defaultValue={defaults.contact_phone}
        hint="Used to connect masked calls. Customers never see this number."
      />
      <Field
        label="Contact email"
        name="contact_email"
        type="email"
        defaultValue={defaults.contact_email}
        hint="For Nexa to reach you. Not shown to customers."
      />

      {state.error ? <Alert>{state.error}</Alert> : null}
      {state.ok ? <Alert tone="success">Saved.</Alert> : null}

      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Saving…" : "Save profile"}
      </Button>
    </form>
  );
}

"use client";

import { useActionState } from "react";
import { submitContactAction, type ContactState } from "./actions";
import { Alert, Button, Field } from "@/components/ui";

const initialState: ContactState = {};

export function ContactForm({
  defaultName,
  defaultContact,
}: {
  defaultName?: string;
  defaultContact?: string;
}) {
  const [state, formAction, pending] = useActionState(submitContactAction, initialState);

  if (state.done) {
    return (
      <Alert tone="success">
        Sent. Someone from Nexa will get back to you shortly.
      </Alert>
    );
  }

  return (
    <form action={formAction} className="space-y-4">
      <Field label="Name (optional)" name="name" defaultValue={defaultName} />
      <Field
        label="Email or phone number"
        name="contact"
        defaultValue={defaultContact}
        required
      />
      <label className="block">
        <span className="mb-1.5 block text-sm font-medium">Message</span>
        <textarea
          name="message"
          rows={5}
          required
          className="w-full rounded-xl border border-[color:var(--color-line)] bg-white px-4 py-3 text-sm"
        />
      </label>

      {state.error ? <Alert>{state.error}</Alert> : null}

      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Sending..." : "Send"}
      </Button>
    </form>
  );
}

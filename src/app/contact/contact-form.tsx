"use client";

import { useActionState } from "react";
import { submitContactAction, type ContactState } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

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
      <div className="rounded-md border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-primary">
        Sent. Someone from Nexa will get back to you shortly.
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="name">Name (optional)</Label>
        <Input id="name" name="name" defaultValue={defaultName} />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="contact">Email or phone number</Label>
        <Input id="contact" name="contact" defaultValue={defaultContact} required />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="message">Message</Label>
        <Textarea id="message" name="message" rows={5} required />
      </div>

      {state.error ? (
        <div className="rounded-md border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {state.error}
        </div>
      ) : null}

      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Sending..." : "Send"}
      </Button>
    </form>
  );
}

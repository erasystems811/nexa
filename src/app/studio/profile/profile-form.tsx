"use client";

import { useActionState } from "react";
import { saveProfileAction, type FormState } from "@/modules/provider/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

/**
 * Contact details are collected but never shown to customers — Nexa masks them.
 * That is why the phone and email fields carry the note they do.
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
      <div className="space-y-1.5">
        <Label htmlFor="business_name">Business name</Label>
        <Input id="business_name" name="business_name" defaultValue={defaults.business_name} required />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="description">Description</Label>
        <Textarea id="description" name="description" defaultValue={defaults.description} rows={3} />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="address">Location</Label>
        <Input id="address" name="address" defaultValue={defaults.address} />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="contact_phone">Contact phone</Label>
        <Input id="contact_phone" name="contact_phone" type="tel" defaultValue={defaults.contact_phone} />
        <p className="text-xs text-muted-foreground">Used to connect masked calls. Customers never see this number.</p>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="contact_email">Contact email</Label>
        <Input id="contact_email" name="contact_email" type="email" defaultValue={defaults.contact_email} />
        <p className="text-xs text-muted-foreground">For Nexa to reach you. Not shown to customers.</p>
      </div>

      {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
      {state.ok ? <p className="text-sm text-emerald-700">Saved.</p> : null}

      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Saving…" : "Save profile"}
      </Button>
    </form>
  );
}

"use client";

import { useActionState } from "react";
import { checkoutAction, type CheckoutState } from "@/modules/bookings/actions";
import { Alert, Button, Field } from "@/components/ui";

const initial: CheckoutState = {};

export function BookingForm({ listingId }: { listingId: string }) {
  const [state, action, pending] = useActionState(checkoutAction, initial);

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="listingId" value={listingId} />
      <Field label="Date" name="date" type="date" required />
      <Field label="Time" name="time" type="time" required />
      <Field label="Address" name="address" placeholder="Where is the event?" />
      <Field label="Notes" name="notes" placeholder="Anything the provider should know" />

      {state.error ? <Alert>{state.error}</Alert> : null}

      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Holding your payment…" : "Confirm and pay"}
      </Button>
      <p className="text-center text-xs text-[color:var(--color-ink-muted)]">
        Your money is held by Nexa, not sent to the provider.
      </p>
    </form>
  );
}

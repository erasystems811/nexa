"use client";

import { useActionState } from "react";
import { checkoutAction, type CheckoutState } from "@/modules/bookings/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initial: CheckoutState = {};

export function BookingForm({ listingId }: { listingId: string }) {
  const [state, action, pending] = useActionState(checkoutAction, initial);

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="listingId" value={listingId} />

      <div className="space-y-1.5">
        <Label htmlFor="date">Date</Label>
        <Input id="date" name="date" type="date" required />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="time">Time</Label>
        <Input id="time" name="time" type="time" required />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="address">Address</Label>
        <Input id="address" name="address" placeholder="Where is the event?" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="notes">Notes</Label>
        <Input id="notes" name="notes" placeholder="Anything the provider should know" />
      </div>

      {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}

      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending ? "Holding your payment…" : "Confirm and pay"}
      </Button>
      <p className="text-center text-xs text-muted-foreground">
        Your money is held by Nexa, not sent to the provider.
      </p>
    </form>
  );
}

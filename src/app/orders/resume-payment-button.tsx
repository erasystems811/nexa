"use client";

import { useActionState } from "react";
import { resumePaymentAction, type CheckoutState } from "@/modules/bookings/actions";
import { Alert, Button } from "@/components/ui";

/**
 * "Complete payment" for a booking that was started but never paid. Submits to
 * resumePaymentAction, which sends the customer to the checkout link (or, with
 * the mock gateway, straight to the now-paid order).
 */
export function ResumePaymentButton({
  bookingId,
  className,
}: {
  bookingId: string;
  className?: string;
}) {
  const [state, action, pending] = useActionState<CheckoutState, FormData>(
    resumePaymentAction,
    {},
  );

  return (
    <form action={action} className={className}>
      <input type="hidden" name="bookingId" value={bookingId} />
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Taking you to payment…" : "Complete payment"}
      </Button>
      {state.error ? (
        <div className="mt-2">
          <Alert>{state.error}</Alert>
        </div>
      ) : null}
    </form>
  );
}

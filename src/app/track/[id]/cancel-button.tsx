"use client";

import { useActionState } from "react";
import { cancelOrderAction, type CancelState } from "./actions";
import { Alert, Button } from "@/components/ui";

export function CancelButton({ bookingId, token }: { bookingId: string; token: string }) {
  const [state, action, pending] = useActionState<CancelState, FormData>(cancelOrderAction, {});

  if (state.done) {
    return <Alert>Cancelled and refunded in full.</Alert>;
  }

  return (
    <form action={action}>
      <input type="hidden" name="bookingId" value={bookingId} />
      <input type="hidden" name="token" value={token} />
      <Button type="submit" variant="ghost" disabled={pending} className="w-full">
        {pending ? "Cancelling…" : "Cancel for a full refund"}
      </Button>
      {state.error ? (
        <div className="mt-2">
          <Alert>{state.error}</Alert>
        </div>
      ) : null}
    </form>
  );
}

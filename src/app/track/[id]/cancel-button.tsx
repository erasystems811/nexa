"use client";

import { useActionState } from "react";
import { cancelOrderAction, type CancelState } from "./actions";
import { Button } from "@/components/ui/button";

export function CancelButton({ bookingId, token }: { bookingId: string; token: string }) {
  const [state, action, pending] = useActionState<CancelState, FormData>(cancelOrderAction, {});

  if (state.done) {
    return <p className="text-sm text-emerald-700">Cancelled and refunded in full.</p>;
  }

  return (
    <form action={action}>
      <input type="hidden" name="bookingId" value={bookingId} />
      <input type="hidden" name="token" value={token} />
      <Button type="submit" variant="ghost" disabled={pending} className="w-full">
        {pending ? "Cancelling…" : "Cancel for a full refund"}
      </Button>
      {state.error ? <p className="mt-2 text-sm text-destructive">{state.error}</p> : null}
    </form>
  );
}

"use client";

import { useActionState } from "react";
import { setPasswordAction, type SetPasswordState } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function SetPasswordForm({ bookingId, token }: { bookingId: string; token: string }) {
  const [state, action, pending] = useActionState<SetPasswordState, FormData>(setPasswordAction, {});

  if (state.done) {
    return (
      <p className="rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
        Password set. Sign in anytime at <strong>/track/signin</strong> with{" "}
        {state.phone ? (
          <>
            your number (<strong>{state.phone}</strong>)
          </>
        ) : (
          "your WhatsApp number"
        )}{" "}
        and this password - no link needed.
      </p>
    );
  }

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="bookingId" value={bookingId} />
      <input type="hidden" name="token" value={token} />
      <div className="space-y-1.5">
        <Label htmlFor="password">New password</Label>
        <Input id="password" name="password" type="password" autoComplete="new-password" required />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="confirm">Confirm password</Label>
        <Input id="confirm" name="confirm" type="password" autoComplete="new-password" required />
      </div>
      <Button type="submit" variant="ghost" disabled={pending} className="w-full">
        {pending ? "Setting password…" : "Set password"}
      </Button>
      {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
    </form>
  );
}

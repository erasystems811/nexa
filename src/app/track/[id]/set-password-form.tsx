"use client";

import { useActionState } from "react";
import { setPasswordAction, type SetPasswordState } from "./actions";
import { Alert, Button, Field } from "@/components/ui";

export function SetPasswordForm({ bookingId, token }: { bookingId: string; token: string }) {
  const [state, action, pending] = useActionState<SetPasswordState, FormData>(setPasswordAction, {});

  if (state.done) {
    return (
      <Alert tone="success">
        Password set. Sign in anytime at <strong>/track/signin</strong> with{" "}
        {state.phone ? <>your number (<strong>{state.phone}</strong>)</> : "your WhatsApp number"} and
        this password - no link needed.
      </Alert>
    );
  }

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="bookingId" value={bookingId} />
      <input type="hidden" name="token" value={token} />
      <Field label="New password" name="password" type="password" autoComplete="new-password" required />
      <Field label="Confirm password" name="confirm" type="password" autoComplete="new-password" required />
      <Button type="submit" variant="ghost" disabled={pending} className="w-full">
        {pending ? "Setting password…" : "Set password"}
      </Button>
      {state.error ? <Alert>{state.error}</Alert> : null}
    </form>
  );
}

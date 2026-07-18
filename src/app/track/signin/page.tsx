"use client";

import { useActionState } from "react";
import { signInWithPhoneAction, type PhoneSignInState } from "./actions";
import { Logo } from "@/components/logo";
import { Alert, Button, Field } from "@/components/ui";

const initialState: PhoneSignInState = {};

/**
 * The permanent door for a WhatsApp customer who set a password on their
 * tracking page - separate from /login, which only ever asks for an email.
 */
export default function TrackSignInPage() {
  const [state, formAction, pending] = useActionState(signInWithPhoneAction, initialState);

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-5 py-12">
      <Logo label="Nexa" markClassName="size-12 rounded-[1.35rem]" textClassName="text-lg" />
      <h1 className="mt-6 text-3xl font-semibold tracking-tight">Sign in</h1>
      <p className="mt-2 text-sm text-[color:var(--color-ink-muted)]">
        For customers who set a password from a WhatsApp booking&rsquo;s tracking page.
      </p>

      <form action={formAction} className="mt-8 space-y-4">
        <Field
          label="WhatsApp number"
          name="phone"
          type="tel"
          autoComplete="tel"
          defaultValue={state.phone ?? ""}
          required
        />
        <Field label="Password" name="password" type="password" autoComplete="current-password" required />

        {state.error ? <Alert>{state.error}</Alert> : null}

        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? "Signing in..." : "Sign in"}
        </Button>
      </form>
    </main>
  );
}

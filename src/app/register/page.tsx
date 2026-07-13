"use client";

import Link from "next/link";
import { useActionState } from "react";
import { signUp, type AuthFormState } from "@/modules/auth/actions";
import { Alert, Button, Field } from "@/components/ui";

const initialState: AuthFormState = {};

export default function RegisterPage() {
  const [state, formAction, pending] = useActionState(signUp, initialState);

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-5 py-12">
      <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--color-ink-muted)]">
        Nexa
      </p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">Create your Nexa account</h1>
      <p className="mt-2 text-sm text-[color:var(--color-ink-muted)]">
        Create it once, then stay signed in while you book vendors and plan your event.
      </p>

      <form action={formAction} className="mt-8 space-y-4">
        <Field label="Full name" name="fullName" autoComplete="name" required />
        <Field label="Email" name="email" type="email" autoComplete="email" required />
        <Field label="Phone" name="phone" type="tel" autoComplete="tel" />
        <Field
          label="Password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          hint="At least 8 characters."
        />

        {state.error ? <Alert>{state.error}</Alert> : null}
        {state.message ? <Alert tone="success">{state.message}</Alert> : null}

        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? "Creating account..." : "Create account"}
        </Button>
      </form>


      <p className="mt-6 text-center text-sm text-[color:var(--color-ink-muted)]">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-[color:var(--color-ink)] underline">
          Sign in
        </Link>
      </p>
    </main>
  );
}

"use client";

import Link from "next/link";
import { useActionState } from "react";
import { signUp, type AuthFormState } from "@/modules/auth/actions";
import { Logo } from "@/components/logo";
import { Alert, Button, Field } from "@/components/ui";

const initialState: AuthFormState = {};

export default function RegisterPage() {
  const [state, formAction, pending] = useActionState(signUp, initialState);

  return (
    <main className="flex min-h-dvh flex-col justify-center px-3 py-8">
      <div className="mx-auto w-full max-w-sm rounded-[1.75rem] border border-[color:var(--color-line)] bg-white px-6 py-10 shadow-card">
      <Link href="/" aria-label="Nexa home">
        <Logo markClassName="size-12 rounded-[1.35rem]" textClassName="text-lg" />
      </Link>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">Create your Nexa account</h1>

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
    </div>
    </main>
  );
}

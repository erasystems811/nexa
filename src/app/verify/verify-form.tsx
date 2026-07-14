"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Logo } from "@/components/logo";
import { Alert, Button, Field } from "@/components/ui";
import { verifySignupCode, type AuthFormState } from "@/modules/auth/actions";

const initialState: AuthFormState = {};

export function VerifyForm({ email }: { email: string }) {
  const [state, formAction, pending] = useActionState(verifySignupCode, initialState);

  return (
    <main className="flex min-h-dvh flex-col justify-center px-3 py-8">
      <div className="mx-auto w-full max-w-sm rounded-[1.75rem] border border-[color:var(--color-line)] bg-white px-6 py-10 shadow-card">
      <Link href="/" aria-label="Nexa home">
        <Logo markClassName="size-12 rounded-[1.35rem]" textClassName="text-lg" />
      </Link>
      <h1 className="mt-6 text-3xl font-semibold tracking-tight">Enter verification code</h1>
      <p className="mt-2 text-sm text-[color:var(--color-ink-muted)]">
        We sent a verification code to {email || "your email"}.
      </p>

      <form action={formAction} className="mt-8 space-y-4">
        <Field label="Email" name="email" type="email" autoComplete="email" defaultValue={email} required />
        <Field
          label="Verification code"
          name="code"
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={8}
          required
        />

        {state.error ? <Alert>{state.error}</Alert> : null}
        {state.message ? <Alert tone="success">{state.message}</Alert> : null}

        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? "Checking..." : "Verify account"}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-[color:var(--color-ink-muted)]">
        Wrong email?{" "}
        <Link href="/register" className="font-medium text-[color:var(--color-ink)] underline">
          Create account again
        </Link>
      </p>
    </div>
    </main>
  );
}

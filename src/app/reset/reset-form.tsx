"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { Logo } from "@/components/logo";
import { Alert, Button, Field } from "@/components/ui";
import { completePasswordReset, requestPasswordReset, type PasswordResetState } from "@/modules/auth/actions";

const initialState: PasswordResetState = {};

export function ResetForm({ email, startAtCode }: { email: string; startAtCode: boolean }) {
  const [requestState, requestAction, requesting] = useActionState(requestPasswordReset, initialState);
  const [completeState, completeAction, completing] = useActionState(completePasswordReset, initialState);
  // Someone arriving from a set-password email already holds a code, so skip
  // straight to step 2 rather than making them ask for a second one.
  const [hasCode, setHasCode] = useState(startAtCode);

  const onCodeStep = hasCode || requestState.sent === true;
  const knownEmail = completeState.email || requestState.email || email;

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-5 py-12">
      <Link href="/" aria-label="Nexa home">
        <Logo markClassName="size-12 rounded-[1.35rem]" textClassName="text-lg" />
      </Link>

      {onCodeStep ? (
        <>
          <h1 className="mt-6 text-3xl font-semibold tracking-tight">Choose a new password</h1>
          <p className="mt-2 text-sm text-[color:var(--color-ink-muted)]">
            Enter the code we sent to {knownEmail || "your email"} and the password you want to use.
          </p>

          <form action={completeAction} className="mt-8 space-y-4">
            <Field label="Email" name="email" type="email" autoComplete="email" defaultValue={knownEmail} required />
            <Field
              label="Reset code"
              name="code"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={8}
              required
            />
            <Field
              label="New password"
              name="password"
              type="password"
              autoComplete="new-password"
              minLength={8}
              hint="At least 8 characters."
              required
            />

            {requestState.message && !completeState.error ? (
              <Alert tone="success">{requestState.message}</Alert>
            ) : null}
            {completeState.error ? <Alert>{completeState.error}</Alert> : null}

            <Button type="submit" className="w-full" disabled={completing}>
              {completing ? "Saving..." : "Save password and sign in"}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-[color:var(--color-ink-muted)]">
            Need a new code?{" "}
            <button
              type="button"
              onClick={() => setHasCode(false)}
              className="font-medium text-[color:var(--color-ink)] underline"
            >
              Send another
            </button>
          </p>
        </>
      ) : (
        <>
          <h1 className="mt-6 text-3xl font-semibold tracking-tight">Reset your password</h1>
          <p className="mt-2 text-sm text-[color:var(--color-ink-muted)]">
            Enter your email and we will send you a code to set a new password.
          </p>

          <form action={requestAction} className="mt-8 space-y-4">
            <Field label="Email" name="email" type="email" autoComplete="email" defaultValue={knownEmail} required />

            {requestState.error ? <Alert>{requestState.error}</Alert> : null}

            <Button type="submit" className="w-full" disabled={requesting}>
              {requesting ? "Sending..." : "Send reset code"}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-[color:var(--color-ink-muted)]">
            Already have a code?{" "}
            <button
              type="button"
              onClick={() => setHasCode(true)}
              className="font-medium text-[color:var(--color-ink)] underline"
            >
              Enter it
            </button>
          </p>
        </>
      )}

      <p className="mt-3 text-center text-sm text-[color:var(--color-ink-muted)]">
        Remembered it?{" "}
        <Link href="/login" className="font-medium text-[color:var(--color-ink)] underline">
          Sign in
        </Link>
      </p>
    </main>
  );
}

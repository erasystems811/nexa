"use client";

import Link from "next/link";
import { useActionState } from "react";
import { signIn, type AuthFormState } from "@/modules/auth/actions";
import { Logo } from "@/components/logo";
import { Alert, Button, Field } from "@/components/ui";

const initialState: AuthFormState = {};

export function LoginForm({ next }: { next: string }) {
  const [state, formAction, pending] = useActionState(signIn, initialState);

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-5 py-12">
      <Link href="/" aria-label="Nexa home">
        <Logo markClassName="size-12 rounded-[1.35rem]" textClassName="text-lg" />
      </Link>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">Welcome back</h1>
      <p className="mt-2 text-sm text-[color:var(--color-ink-muted)]">
        Sign in once and continue planning your event.
      </p>

      <form action={formAction} className="mt-8 space-y-4">
        <input type="hidden" name="next" value={next} />
        <Field label="Email" name="email" type="email" autoComplete="email" required />
        <Field
          label="Password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
        />

        {state.error ? <Alert>{state.error}</Alert> : null}
        {state.message ? <Alert tone="success">{state.message}</Alert> : null}

        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? "Signing in..." : "Sign in"}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-[color:var(--color-ink-muted)]">
        New to Nexa?{" "}
        <Link href="/register" className="font-medium text-[color:var(--color-ink)] underline">
          Create an account
        </Link>
      </p>
    </main>
  );
}


"use client";

import Link from "next/link";
import { useActionState } from "react";
import { signIn, type AuthFormState } from "@/modules/auth/actions";
import { Logo } from "@/components/logo";
import { Alert, Button, Field } from "@/components/ui";
import type { Surface } from "@/lib/surfaces";

const initialState: AuthFormState = {};

function loginCopy(next: string, surface: Surface) {
  if (surface === "admin" || next === "/admin" || next.startsWith("/admin/")) {
    return {
      label: "Nexa Admin",
      title: "Admin Console",
      subtitle: "Staff-only access for managing providers, listings, orders, payments, and disputes.",
      footer: "Only active Nexa staff accounts can enter Admin.",
      showRegister: false,
    };
  }

  if (surface === "studio" || next === "/studio" || next.startsWith("/studio/")) {
    return {
      label: "Business Studio",
      title: "Provider sign in",
      subtitle: "Provider-only access for managing listings, bookings, messages, wallet, and reviews.",
      footer: "Provider accounts must be approved before Studio access.",
      showRegister: false,
    };
  }

  return {
    label: "Nexa",
    title: "Welcome back",
    subtitle: "Sign in once and continue planning your event.",
    footer: "New to Nexa?",
    showRegister: true,
  };
}

export function LoginForm({ next, surface }: { next: string; surface: Surface }) {
  const [state, formAction, pending] = useActionState(signIn, initialState);
  const copy = loginCopy(next, surface);
  const isAdmin = surface === "admin" || next === "/admin" || next.startsWith("/admin/");

  return (
    <main className="flex min-h-dvh flex-col justify-center px-3 py-8">
      <div className="mx-auto w-full max-w-sm rounded-[1.75rem] border border-[color:var(--color-line)] bg-white px-6 py-10 shadow-card">
      <Link href="/" aria-label={`${copy.label} home`}>
        <Logo label={copy.label} markClassName="size-12 rounded-[1.35rem]" textClassName="text-lg" />
      </Link>
      <h1 className="mt-6 text-3xl font-semibold tracking-tight">{copy.title}</h1>
      <p className="mt-2 text-sm text-[color:var(--color-ink-muted)]">
        {copy.subtitle}
      </p>

      <form action={formAction} className="mt-8 space-y-4">
        <input type="hidden" name="next" value={next} />
        <input type="hidden" name="surface" value={surface} />
        <Field
          label={isAdmin ? "Username" : "Email"}
          name="email"
          type={isAdmin ? "text" : "email"}
          autoComplete={isAdmin ? "username" : "email"}
          required
        />
        <Field
          label="Password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
        />

        {/* The Admin login is a fixed env username/password, so there is nothing
            for a code to reset. Everyone else — including a vendor whose account
            Admin created without a password — starts here. */}
        {isAdmin ? null : (
          <p className="text-right text-sm">
            <Link href="/reset" className="font-medium text-[color:var(--color-ink)] underline">
              Forgot password?
            </Link>
          </p>
        )}

        {state.error ? <Alert>{state.error}</Alert> : null}
        {state.message ? <Alert tone="success">{state.message}</Alert> : null}

        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? "Signing in..." : "Sign in"}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-[color:var(--color-ink-muted)]">
        {copy.footer}{" "}
        {copy.showRegister ? (
          <Link href="/register" className="font-medium text-[color:var(--color-ink)] underline">
            Create an account
          </Link>
        ) : null}
      </p>
    </div>
    </main>
  );
}

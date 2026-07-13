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
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-5 py-12">
      <Link href={surface === "admin" ? "/admin" : "/"} aria-label={`${copy.label} home`}>
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
    </main>
  );
}

"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useActionState } from "react";
import { signIn, type AuthFormState } from "@/modules/auth/actions";
import { Alert, Button, Card, Field } from "@/components/ui";

const initialState: AuthFormState = {};

function surfaceCopy(next: string) {
  if (next === "/admin" || next.startsWith("/admin/")) {
    return {
      label: "Nexa Admin",
      title: "Admin Console",
      subtitle: "Sign in with your Nexa staff account to manage providers, listings, orders, payments, and disputes.",
      footer: "Staff access only. Customer accounts cannot open Admin.",
      showRegister: false,
    };
  }

  if (next === "/studio" || next.startsWith("/studio/")) {
    return {
      label: "Business Studio",
      title: "Provider sign in",
      subtitle: "Sign in to manage your listings, bookings, messages, wallet, and reviews.",
      footer: "Provider access only. New providers must be approved first.",
      showRegister: false,
    };
  }

  return {
    label: "Nexa",
    title: "Welcome back",
    subtitle: "Open one app. Close it knowing your event is under control.",
    footer: "New to Nexa?",
    showRegister: true,
  };
}

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(signIn, initialState);
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "";
  const copy = surfaceCopy(next);

  return (
    <main className="relative flex min-h-dvh items-center justify-center overflow-hidden px-5 py-12">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top_left,rgba(15,47,95,0.16),transparent_34%),linear-gradient(135deg,#f8fbff_0%,#ffffff_48%,#f5f7f1_100%)]" />
      <Card className="w-full max-w-md border-white/70 bg-white/88 p-6 shadow-elevated backdrop-blur sm:p-8">
        <Link href="/" className="inline-flex items-center gap-2 text-sm font-semibold tracking-tight">
          <span className="flex size-9 items-center justify-center rounded-2xl bg-[color:var(--color-accent)] text-white">N</span>
          {copy.label}
        </Link>
        <h1 className="mt-8 text-3xl font-semibold tracking-tight">{copy.title}</h1>
        <p className="mt-2 text-sm leading-6 text-[color:var(--color-ink-muted)]">
          {copy.subtitle}
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
      </Card>
    </main>
  );
}

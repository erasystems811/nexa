"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { signIn, type AuthFormState } from "@/modules/auth/actions";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BackLink } from "@/components/back-link";
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
    subtitle: "Sign in once, and manage every booking from your dashboard.",
    footer: "New to Nexa?",
    showRegister: true,
  };
}

export function LoginForm({ next, surface }: { next: string; surface: Surface }) {
  const [state, formAction, pending] = useActionState(signIn, initialState);
  const [showPassword, setShowPassword] = useState(false);
  const copy = loginCopy(next, surface);
  const isAdmin = surface === "admin" || next === "/admin" || next.startsWith("/admin/");
  const isStudio = surface === "studio" || next === "/studio" || next.startsWith("/studio/");

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-5 py-12">
      {isAdmin || isStudio ? null : <BackLink />}
      <Link href="/" aria-label={`${copy.label} home`} className="mb-6 flex justify-center">
        <Logo label={copy.label} markClassName="size-12 rounded-2xl" textClassName="text-lg" />
      </Link>

      <Card>
        <CardHeader className="space-y-1 text-center">
          <CardTitle className="font-serif text-2xl">{copy.title}</CardTitle>
          <CardDescription>{copy.subtitle}</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={formAction} className="space-y-4">
            <input type="hidden" name="next" value={next} />
            <input type="hidden" name="surface" value={surface} />

            <div className="space-y-2">
              <Label htmlFor="email">{isAdmin ? "Username" : "Email"}</Label>
              <Input
                id="email"
                name="email"
                type={isAdmin ? "text" : "email"}
                autoComplete={isAdmin ? "username" : "email"}
                // Keeps what they typed when a sign-in fails, instead of blanking it.
                defaultValue={state.identifier ?? ""}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  required
                  className="pr-9"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="absolute inset-y-0 right-0 flex w-9 items-center justify-center text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>

            {/* The Admin login is a fixed env username/password, so there is nothing
                for a code to reset. Everyone else — including a vendor whose account
                Admin created without a password — starts here. */}
            {isAdmin ? null : (
              <p className="text-right text-sm">
                <Link href="/reset" className="font-medium text-foreground underline">
                  Forgot password?
                </Link>
              </p>
            )}

            {state.error ? <p className="text-sm font-medium text-destructive">{state.error}</p> : null}
            {state.message ? <p className="text-sm font-medium text-emerald-700">{state.message}</p> : null}

            <Button type="submit" className="w-full" disabled={pending}>
              {pending ? "Signing in..." : "Sign in"}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            {copy.footer}{" "}
            {copy.showRegister ? (
              <Link href="/register" className="font-medium text-foreground underline">
                Create an account
              </Link>
            ) : null}
          </p>
        </CardContent>
      </Card>
    </main>
  );
}

"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { verifySignupCode, type AuthFormState } from "@/modules/auth/actions";
import { BackLink } from "@/components/back-link";

const initialState: AuthFormState = {};

export function VerifyForm({ email }: { email: string }) {
  const [state, formAction, pending] = useActionState(verifySignupCode, initialState);

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-5 py-12">
      <BackLink />
      <Link href="/" aria-label="Nexa home" className="mb-6 flex justify-center">
        <Logo markClassName="size-12 rounded-2xl" textClassName="text-lg" />
      </Link>

      <Card>
        <CardHeader className="space-y-1 text-center">
          <CardTitle className="font-serif text-2xl">Enter verification code</CardTitle>
          <CardDescription>We sent a verification code to {email || "your email"}.</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={formAction} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                defaultValue={email}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="code">Verification code</Label>
              <Input
                id="code"
                name="code"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={8}
                required
              />
            </div>

            {state.error ? <p className="text-sm font-medium text-destructive">{state.error}</p> : null}
            {state.message ? <p className="text-sm font-medium text-emerald-700">{state.message}</p> : null}

            <Button type="submit" className="w-full" disabled={pending}>
              {pending ? "Checking..." : "Verify account"}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            Wrong email?{" "}
            <Link href="/register" className="font-medium text-foreground underline">
              Create account again
            </Link>
          </p>
        </CardContent>
      </Card>
    </main>
  );
}

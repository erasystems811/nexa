"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { completePasswordReset, requestPasswordReset, type PasswordResetState } from "@/modules/auth/actions";
import { BackLink } from "@/components/back-link";
import type { Surface } from "@/lib/surfaces";

const initialState: PasswordResetState = {};

export function ResetForm({
  email,
  startAtCode,
  surface,
}: {
  email: string;
  startAtCode: boolean;
  // Which app this reset belongs to. Reset on the vendor app targets the vendor
  // account for the email; on the customer app, the customer account.
  surface: Surface;
}) {
  const [requestState, requestAction, requesting] = useActionState(requestPasswordReset, initialState);
  const [completeState, completeAction, completing] = useActionState(completePasswordReset, initialState);
  // Someone arriving from a set-password email already holds a code, so skip
  // straight to step 2 rather than making them ask for a second one.
  const [hasCode, setHasCode] = useState(startAtCode);
  const [showPassword, setShowPassword] = useState(false);

  const onCodeStep = hasCode || requestState.sent === true;
  const knownEmail = completeState.email || requestState.email || email;

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-5 py-12">
      {surface === "customer" ? <BackLink /> : null}
      <Link href="/" aria-label="Nexa home" className="mb-6 flex justify-center">
        <Logo markClassName="size-12 rounded-2xl" textClassName="text-lg" />
      </Link>

      <Card>
        {onCodeStep ? (
          <>
            <CardHeader className="space-y-1 text-center">
              <CardTitle className="font-serif text-2xl">Choose a new password</CardTitle>
              <CardDescription>
                Enter the code we sent to {knownEmail || "your email"} and the password you want to use.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form action={completeAction} className="space-y-4">
                <input type="hidden" name="surface" value={surface} />

                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" name="email" type="email" autoComplete="email" defaultValue={knownEmail} required />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="code">Reset code</Label>
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

                <div className="space-y-2">
                  <Label htmlFor="password">New password</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      name="password"
                      type={showPassword ? "text" : "password"}
                      autoComplete="new-password"
                      minLength={8}
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
                  <p className="text-sm text-muted-foreground">At least 8 characters.</p>
                </div>

                {requestState.message && !completeState.error ? (
                  <p className="text-sm font-medium text-emerald-700">{requestState.message}</p>
                ) : null}
                {completeState.error ? <p className="text-sm font-medium text-destructive">{completeState.error}</p> : null}

                <Button type="submit" className="w-full" disabled={completing}>
                  {completing ? "Saving..." : "Save password and sign in"}
                </Button>
              </form>

              <p className="mt-6 text-center text-sm text-muted-foreground">
                Need a new code?{" "}
                <button
                  type="button"
                  onClick={() => setHasCode(false)}
                  className="font-medium text-foreground underline"
                >
                  Send another
                </button>
              </p>
            </CardContent>
          </>
        ) : (
          <>
            <CardHeader className="space-y-1 text-center">
              <CardTitle className="font-serif text-2xl">Reset your password</CardTitle>
              <CardDescription>Enter your email and we will send you a code to set a new password.</CardDescription>
            </CardHeader>
            <CardContent>
              <form action={requestAction} className="space-y-4">
                <input type="hidden" name="surface" value={surface} />

                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" name="email" type="email" autoComplete="email" defaultValue={knownEmail} required />
                </div>

                {requestState.error ? <p className="text-sm font-medium text-destructive">{requestState.error}</p> : null}

                <Button type="submit" className="w-full" disabled={requesting}>
                  {requesting ? "Sending..." : "Send reset code"}
                </Button>
              </form>

              <p className="mt-6 text-center text-sm text-muted-foreground">
                Already have a code?{" "}
                <button
                  type="button"
                  onClick={() => setHasCode(true)}
                  className="font-medium text-foreground underline"
                >
                  Enter it
                </button>
              </p>
            </CardContent>
          </>
        )}
      </Card>

      <p className="mt-4 text-center text-sm text-muted-foreground">
        Remembered it?{" "}
        <Link href="/login" className="font-medium text-foreground underline">
          Sign in
        </Link>
      </p>
    </main>
  );
}

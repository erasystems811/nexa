"use client";

import { useActionState } from "react";
import { signInWithPhoneAction, type PhoneSignInState } from "./actions";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initialState: PhoneSignInState = {};

/**
 * The permanent door for a WhatsApp customer who set a password on their
 * tracking page - separate from /login, which only ever asks for an email.
 */
export default function TrackSignInPage() {
  const [state, formAction, pending] = useActionState(signInWithPhoneAction, initialState);

  return (
    <div className="mx-auto max-w-sm">
      <Card>
        <CardHeader>
          <CardTitle className="font-serif text-2xl">Sign in</CardTitle>
          <CardDescription>
            For customers who set a password from a WhatsApp booking&rsquo;s tracking page.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={formAction} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="phone">WhatsApp number</Label>
              <Input
                id="phone"
                name="phone"
                type="tel"
                autoComplete="tel"
                defaultValue={state.phone ?? ""}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <Input id="password" name="password" type="password" autoComplete="current-password" required />
            </div>

            {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}

            <Button type="submit" className="w-full" disabled={pending}>
              {pending ? "Signing in..." : "Sign in"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

"use client";

import { useActionState, useState } from "react";
import { addProviderAction, type AdminActionState } from "@/modules/admin/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

/** Add a vendor by hand. */
export function AddProvider() {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(addProviderAction, {} as AdminActionState);

  if (!open) {
    return (
      <Button onClick={() => setOpen(true)} className="shrink-0">
        Add a vendor
      </Button>
    );
  }

  return (
    <Card className="w-full">
      <CardContent className="pt-6">
        <form action={action}>
          <h2 className="text-sm font-semibold">Add a vendor</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Creates their account and approves them straight away. They get an email with a code to set their own
            password.
          </p>
          <div className="mt-3 space-y-2">
            <Input name="email" type="email" placeholder="Email" required />
            <Input name="business_name" placeholder="Business name" required />
          </div>
          {state.error ? <p className="mt-2 text-sm text-destructive">{state.error}</p> : null}
          {state.ok ? (
            <div className="mt-2 space-y-1">
              <p className="text-sm text-emerald-700">
                {state.warning ? "Vendor added." : "Vendor added. A set-password email is on its way to them."}
              </p>
              {state.warning ? <p className="text-sm text-destructive">{state.warning}</p> : null}
            </div>
          ) : null}
          <div className="mt-3 flex gap-2">
            <Button type="submit" disabled={pending}>
              {pending ? "Adding…" : "Add vendor"}
            </Button>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

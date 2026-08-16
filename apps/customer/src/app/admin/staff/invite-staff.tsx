"use client";

import { useActionState, useState } from "react";
import { inviteStaffAction, type AdminActionState } from "@/modules/admin/actions";
import { STAFF_ROLES, STAFF_ROLE_LABELS } from "@/modules/admin/permissions";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export function InviteStaff() {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(inviteStaffAction, {} as AdminActionState);

  if (!open) {
    return <Button onClick={() => setOpen(true)}>Add a staff member</Button>;
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <form action={action}>
          <h2 className="text-sm font-semibold">Add a staff member</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Creates their own login and starts them on the chosen role&rsquo;s views. You can grant extra views
            after. They are emailed a code to set their own password.
          </p>
          <div className="mt-3 space-y-2">
            <Input name="full_name" placeholder="Full name" required />
            <Input name="email" type="email" placeholder="Work email" required />
            <Input name="department" placeholder="Department (optional)" />
            <select
              name="role"
              required
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-sm outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              {STAFF_ROLES.map((r) => (
                <option key={r} value={r}>
                  {STAFF_ROLE_LABELS[r]}
                </option>
              ))}
            </select>
          </div>
          {state.error ? <p className="mt-2 text-sm text-destructive">{state.error}</p> : null}
          {state.ok ? (
            <div className="mt-2 space-y-1">
              <p className="text-sm text-emerald-500">
                {state.warning ? "Staff member added." : "Staff member added. A set-password email is on its way to them."}
              </p>
              {state.warning ? <p className="text-sm text-destructive">{state.warning}</p> : null}
            </div>
          ) : null}
          <div className="mt-3 flex gap-2">
            <Button type="submit" disabled={pending}>
              {pending ? "Adding…" : "Add staff"}
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

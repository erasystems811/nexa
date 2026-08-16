"use client";

import { useActionState } from "react";
import { saveBankAction, type FormState } from "@/modules/provider/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface Bank {
  code: string;
  name: string;
}

/**
 * Where Nexa sends the vendor's money.
 *
 * This asked for a "Bank code" and expected a vendor to type 058. Nobody knows
 * that number — they would type "GTBank", or guess, and the payout would fail
 * weeks later looking like Nexa refusing to pay them. Now they pick their bank
 * by name and Nexa keeps the code to itself.
 *
 * The typed field survives as a fallback for the one case that matters: if the
 * payment processor cannot be reached, the list arrives empty, and a vendor
 * with no way to enter an account at all would be worse than one typing a code.
 */
export function BankForm({
  banks,
  defaults,
}: {
  banks: Bank[];
  defaults: { bank_code: string; bank_account_number: string; bank_account_name: string };
}) {
  const [state, action, pending] = useActionState(saveBankAction, {} as FormState);

  return (
    <form action={action} className="space-y-3">
      {banks.length > 0 ? (
        <div className="space-y-1.5">
          <Label htmlFor="bank_code">Your bank</Label>
          <select
            id="bank_code"
            name="bank_code"
            required
            defaultValue={defaults.bank_code}
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            <option value="" disabled>
              Choose your bank
            </option>
            {banks.map((b) => (
              <option key={b.code} value={b.code}>
                {b.name}
              </option>
            ))}
          </select>
        </div>
      ) : (
        <div className="space-y-1.5">
          <Label htmlFor="bank_code">Bank code</Label>
          <Input id="bank_code" name="bank_code" defaultValue={defaults.bank_code} required />
          <p className="text-xs text-muted-foreground">
            Nexa could not load the list of banks just now. Try again in a moment, or enter your bank&rsquo;s code
            if you know it.
          </p>
        </div>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="bank_account_number">Account number</Label>
        <Input
          id="bank_account_number"
          name="bank_account_number"
          defaultValue={defaults.bank_account_number}
          inputMode="numeric"
          required
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="bank_account_name">Account name</Label>
        <Input id="bank_account_name" name="bank_account_name" defaultValue={defaults.bank_account_name} required />
        <p className="text-xs text-muted-foreground">
          Exactly as your bank has it. A name that does not match the account will bounce the payment.
        </p>
      </div>

      {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
      {state.ok ? <p className="text-sm text-emerald-700">Saved.</p> : null}

      <Button type="submit" variant="outline" className="w-full" disabled={pending}>
        {pending ? "Saving…" : "Save payout account"}
      </Button>
    </form>
  );
}

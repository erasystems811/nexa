"use client";

import { useActionState } from "react";
import { saveBankAction, type FormState } from "@/modules/provider/actions";
import { Alert, Button, Field } from "@/components/ui";

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
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium">Your bank</span>
          <select
            name="bank_code"
            required
            defaultValue={defaults.bank_code}
            className="h-12 w-full rounded-xl border border-[color:var(--color-line)] bg-white px-4"
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
        </label>
      ) : (
        <Field
          label="Bank code"
          name="bank_code"
          defaultValue={defaults.bank_code}
          required
          hint="Nexa could not load the list of banks just now. Try again in a moment, or enter your bank's code if you know it."
        />
      )}

      <Field
        label="Account number"
        name="bank_account_number"
        defaultValue={defaults.bank_account_number}
        inputMode="numeric"
        required
      />
      <Field
        label="Account name"
        name="bank_account_name"
        defaultValue={defaults.bank_account_name}
        required
        hint="Exactly as your bank has it. A name that does not match the account will bounce the payment."
      />

      {state.error ? <Alert>{state.error}</Alert> : null}
      {state.ok ? <Alert tone="success">Saved.</Alert> : null}

      <Button type="submit" variant="ghost" className="w-full" disabled={pending}>
        {pending ? "Saving…" : "Save payout account"}
      </Button>
    </form>
  );
}

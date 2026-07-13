"use client";

import { useActionState } from "react";
import { saveBankAction, type FormState } from "@/modules/provider/actions";
import { Alert, Button, Field } from "@/components/ui";

/**: manage bank details. Balances are not the provider's to touch. */
export function BankForm({
  defaults,
}: {
  defaults: { bank_code: string; bank_account_number: string; bank_account_name: string };
}) {
  const [state, action, pending] = useActionState(saveBankAction, {} as FormState);

  return (
    <form action={action} className="space-y-3">
      <Field label="Bank code" name="bank_code" defaultValue={defaults.bank_code} />
      <Field label="Account number" name="bank_account_number" defaultValue={defaults.bank_account_number} />
      <Field label="Account name" name="bank_account_name" defaultValue={defaults.bank_account_name} />
      {state.error ? <Alert>{state.error}</Alert> : null}
      {state.ok ? <Alert tone="success">Saved.</Alert> : null}
      <Button type="submit" variant="ghost" className="w-full" disabled={pending}>
        {pending ? "Saving…" : "Save payout account"}
      </Button>
    </form>
  );
}

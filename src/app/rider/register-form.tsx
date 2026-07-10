"use client";

import { useActionState } from "react";
import { registerRiderAction, type RiderFormState } from "@/modules/rider/actions";
import { Alert, Button, Field } from "@/components/ui";

/** PRD Section 15: name, contact, vehicle type. Documents follow after signup. */
export function RegisterForm() {
  const [state, action, pending] = useActionState(registerRiderAction, {} as RiderFormState);

  return (
    <form action={action} className="space-y-4">
      <Field label="Full name" name="full_name" required />
      <Field label="Contact phone" name="phone" type="tel" required />

      <label className="block">
        <span className="mb-1.5 block text-sm font-medium">Vehicle type</span>
        <select
          name="vehicle_type"
          className="h-12 w-full rounded-xl border border-[color:var(--color-line)] bg-white px-4"
          defaultValue="bike"
        >
          <option value="bike">Bike</option>
          <option value="car">Car</option>
          <option value="van">Van / bus</option>
        </select>
        <span className="mt-1 block text-xs text-[color:var(--color-ink-muted)]">
          Bulk and large orders are matched to cars and vans, not bikes.
        </span>
      </label>

      <Field label="Vehicle plate (optional)" name="vehicle_plate" />

      {state.error ? <Alert>{state.error}</Alert> : null}

      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Submitting…" : "Register as a rider"}
      </Button>
      <p className="text-center text-xs text-[color:var(--color-ink-muted)]">
        Nexa verifies every rider before assigning deliveries.
      </p>
    </form>
  );
}

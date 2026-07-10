"use client";

import { useActionState, useState, useTransition } from "react";
import {
  acceptAction,
  arrivedAction,
  confirmDeliveryAction,
  confirmReturnAction,
  declineAction,
  enRouteAction,
  pickedUpAction,
  type RiderFormState,
} from "@/modules/rider/actions";
import type { RiderAssignmentStatus } from "@/lib/db/types";
import { Alert } from "@/components/ui";

/**
 * The delivery flow. PRD Section 15: picked up → en route → arrived → enter the
 * customer's code. The code is the only way to complete it — there is no "done"
 * button, by design.
 */
export function DeliveryFlow({
  assignmentId,
  status,
  isReturn,
}: {
  assignmentId: string;
  status: RiderAssignmentStatus;
  isReturn: boolean;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [condition, setCondition] = useState("");

  const run = (fn: () => Promise<void>) =>
    start(async () => {
      setError(null);
      try {
        await fn();
      } catch (e) {
        setError(e instanceof Error ? e.message : "That did not work");
      }
    });

  if (status === "assigned") {
    return (
      <div className="space-y-2">
        <Big onClick={() => run(() => acceptAction(assignmentId))} disabled={pending}>
          Accept this delivery
        </Big>
        <button
          type="button"
          disabled={pending}
          onClick={() => run(() => declineAction(assignmentId))}
          className="h-11 w-full rounded-full border border-[color:var(--color-line)] text-sm font-medium disabled:opacity-40"
        >
          Decline
        </button>
        {error ? <Alert>{error}</Alert> : null}
      </div>
    );
  }

  if (status === "accepted") {
    return (
      <div className="space-y-3">
        {isReturn ? (
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium">Item condition at pickup</span>
            <textarea
              value={condition}
              onChange={(e) => setCondition(e.target.value)}
              rows={2}
              placeholder="Note any visible damage before you collect"
              className="w-full rounded-xl border border-[color:var(--color-line)] px-4 py-3 text-sm"
            />
          </label>
        ) : null}
        <Big
          onClick={() => run(() => pickedUpAction(assignmentId, isReturn ? condition : undefined))}
          disabled={pending}
        >
          {isReturn ? "Mark collected from customer" : "Mark picked up from provider"}
        </Big>
        {error ? <Alert>{error}</Alert> : null}
      </div>
    );
  }

  if (status === "picked_up") {
    return (
      <div className="space-y-2">
        <Big onClick={() => run(() => enRouteAction(assignmentId))} disabled={pending}>
          Mark en route
        </Big>
        {error ? <Alert>{error}</Alert> : null}
      </div>
    );
  }

  if (status === "en_route") {
    return (
      <div className="space-y-2">
        <Big onClick={() => run(() => arrivedAction(assignmentId))} disabled={pending}>
          Mark arrived
        </Big>
        {error ? <Alert>{error}</Alert> : null}
      </div>
    );
  }

  if (status === "arrived") {
    return isReturn ? <ReturnCode assignmentId={assignmentId} /> : <DeliveryCode assignmentId={assignmentId} />;
  }

  return (
    <Alert tone="success">
      {status === "returned" ? "Returned and paid." : "Delivered and paid."}
    </Alert>
  );
}

function DeliveryCode({ assignmentId }: { assignmentId: string }) {
  const [state, action, pending] = useActionState(
    confirmDeliveryAction.bind(null, assignmentId),
    {} as RiderFormState,
  );
  return (
    <form action={action} className="space-y-3">
      <label className="block">
        <span className="mb-1.5 block text-sm font-medium">
          Enter the customer&rsquo;s delivery code
        </span>
        <input
          name="code"
          autoCapitalize="characters"
          required
          className="h-14 w-full rounded-xl border border-[color:var(--color-line)] px-4 text-center font-mono text-2xl tracking-[0.3em] uppercase outline-none focus:border-[color:var(--color-ink)]"
        />
      </label>
      {state.error ? <Alert>{state.error}</Alert> : null}
      <button
        type="submit"
        disabled={pending}
        className="h-12 w-full rounded-full bg-[color:var(--color-ink)] text-sm font-medium text-white disabled:opacity-40"
      >
        {pending ? "Confirming…" : "Confirm delivery"}
      </button>
      <p className="text-center text-xs text-[color:var(--color-ink-muted)]">
        The customer reads this out. It releases the payment.
      </p>
    </form>
  );
}

function ReturnCode({ assignmentId }: { assignmentId: string }) {
  const [state, action, pending] = useActionState(
    confirmReturnAction.bind(null, assignmentId),
    {} as RiderFormState,
  );
  return (
    <form action={action} className="space-y-3">
      <label className="block">
        <span className="mb-1.5 block text-sm font-medium">Enter the customer&rsquo;s return code</span>
        <input
          name="code"
          autoCapitalize="characters"
          required
          className="h-14 w-full rounded-xl border border-[color:var(--color-line)] px-4 text-center font-mono text-2xl tracking-[0.3em] uppercase outline-none focus:border-[color:var(--color-ink)]"
        />
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="damaged" className="h-4 w-4" />
        Items came back damaged
      </label>
      {state.error ? <Alert>{state.error}</Alert> : null}
      <button
        type="submit"
        disabled={pending}
        className="h-12 w-full rounded-full bg-[color:var(--color-ink)] text-sm font-medium text-white disabled:opacity-40"
      >
        {pending ? "Confirming…" : "Confirm return"}
      </button>
      <p className="text-center text-xs text-[color:var(--color-ink-muted)]">
        Good condition refunds the customer&rsquo;s caution fee. Damage goes to Admin.
      </p>
    </form>
  );
}

function Big({
  children,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="h-12 w-full rounded-full bg-[color:var(--color-ink)] text-sm font-medium text-white disabled:opacity-40"
    >
      {children}
    </button>
  );
}

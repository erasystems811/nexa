"use client";

import { useState, useTransition } from "react";
import {
  acceptOrderAction,
  rejectOrderAction,
  startWorkAction,
} from "@/modules/provider/actions";
import type { BookingStatus } from "@/lib/db/types";

export function OrderActions({
  bookingId,
  status,
}: {
  bookingId: string;
  status: BookingStatus;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const run = (fn: () => Promise<void>) =>
    start(async () => {
      setError(null);
      try {
        await fn();
      } catch (e) {
        setError(e instanceof Error ? e.message : "That did not work");
      }
    });

  return (
    <div className="mt-4 flex flex-wrap gap-2">
      {status === "paid_held" ? (
        <div className="w-full">
          <p className="mb-2 text-xs text-[color:var(--color-ink-muted)]">
            The customer has paid and Nexa is holding the whole amount. Accept it,
            do the job, and Nexa pays you once the customer gives you their
            completion code.
          </p>
          <div className="flex gap-2">
            <Btn primary disabled={pending} onClick={() => run(() => acceptOrderAction(bookingId))}>
              Accept booking
            </Btn>
            <Btn disabled={pending} onClick={() => run(() => rejectOrderAction(bookingId))}>
              Decline
            </Btn>
          </div>
        </div>
      ) : null}

      {status === "accepted" ? (
        <Btn primary disabled={pending} onClick={() => run(() => startWorkAction(bookingId))}>
          Mark work started
        </Btn>
      ) : null}

      {status === "in_progress" ? (
        <p className="text-xs text-[color:var(--color-ink-muted)]">
          When the job is done, ask the customer for their completion code and enter
          it. That is what tells Nexa to pay you.
        </p>
      ) : null}

      {error ? <p className="w-full text-xs text-[color:var(--color-danger)]">{error}</p> : null}
    </div>
  );
}

function Btn({
  children,
  onClick,
  disabled,
  primary,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  primary?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={
        primary
          ? "h-10 rounded-lg bg-[color:var(--color-ink)] px-4 text-sm font-medium text-white disabled:opacity-40"
          : "h-10 rounded-lg border border-[color:var(--color-line)] px-4 text-sm font-medium disabled:opacity-40"
      }
    >
      {children}
    </button>
  );
}

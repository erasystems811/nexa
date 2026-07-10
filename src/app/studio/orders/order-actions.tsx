"use client";

import { useState, useTransition } from "react";
import {
  acceptOrderAction,
  checkInAction,
  markReadyAction,
  rejectOrderAction,
} from "@/modules/provider/actions";
import type { BookingStatus } from "@/lib/db/types";

export function OrderActions({
  bookingId,
  status,
  isGoods,
  readyMarked,
  stage1Done,
}: {
  bookingId: string;
  status: BookingStatus;
  isGoods: boolean;
  readyMarked: boolean;
  stage1Done: boolean;
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
        <>
          <Btn primary disabled={pending} onClick={() => run(() => acceptOrderAction(bookingId))}>
            Accept
          </Btn>
          <Btn disabled={pending} onClick={() => run(() => rejectOrderAction(bookingId))}>
            Decline
          </Btn>
        </>
      ) : null}

      {status === "accepted" && isGoods ? (
        readyMarked ? (
          <p className="text-xs text-[color:var(--color-ink-muted)]">
            Marked ready — a rider will be assigned to collect it.
          </p>
        ) : (
          <Btn primary disabled={pending} onClick={() => run(() => markReadyAction(bookingId))}>
            Mark ready for pickup
          </Btn>
        )
      ) : null}

      {status === "accepted" && !isGoods && !stage1Done ? (
        <Btn primary disabled={pending} onClick={() => run(() => checkInAction(bookingId))}>
          Check in at venue
        </Btn>
      ) : null}

      {status === "in_progress" ? (
        <p className="text-xs text-[color:var(--color-ink-muted)]">
          Waiting for the customer&rsquo;s confirmation code to complete this.
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

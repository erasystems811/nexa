"use client";

import { useState, useTransition } from "react";
import {
  acceptOrderAction,
  callRiderAction,
  checkInAction,
  rejectOrderAction,
} from "@/modules/provider/actions";
import type { BookingStatus } from "@/lib/db/types";

const RIDER_STATUS_LABEL: Record<string, string> = {
  assigned: "Rider called — waiting for them to accept",
  accepted: "Rider on the way to pick up",
  picked_up: "Picked up",
  en_route: "On the way to the customer",
  arrived: "Rider has arrived",
  delivered: "Delivered",
};

export function OrderActions({
  bookingId,
  status,
  isGoods,
  riderCalled,
  riderStatus,
  stage1Done,
}: {
  bookingId: string;
  status: BookingStatus;
  isGoods: boolean;
  riderCalled: boolean;
  riderStatus: string | null;
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

      {(status === "accepted" || status === "in_progress") && isGoods ? (
        riderCalled ? (
          <p className="text-xs text-[color:var(--color-ink-muted)]">
            {riderStatus ? (RIDER_STATUS_LABEL[riderStatus] ?? riderStatus) : "Rider called"}
          </p>
        ) : (
          <div className="w-full">
            <p className="mb-2 text-xs font-medium">Call a rider to collect it</p>
            <div className="flex flex-wrap gap-2">
              <Btn primary disabled={pending} onClick={() => run(() => callRiderAction(bookingId, "bike"))}>
                Call a bike
              </Btn>
              <Btn disabled={pending} onClick={() => run(() => callRiderAction(bookingId, "car"))}>
                Call a car
              </Btn>
              <Btn disabled={pending} onClick={() => run(() => callRiderAction(bookingId, "van"))}>
                Call a van
              </Btn>
            </div>
          </div>
        )
      ) : null}

      {status === "accepted" && !isGoods && !stage1Done ? (
        <Btn primary disabled={pending} onClick={() => run(() => checkInAction(bookingId))}>
          Check in at venue
        </Btn>
      ) : null}

      {status === "in_progress" && !isGoods ? (
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

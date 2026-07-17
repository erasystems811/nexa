"use client";

import { useState, useTransition } from "react";
import {
  acceptOrderAction,
  rejectOrderAction,
  startWorkAction,
  enterCodeAction,
  reportProblemAction,
} from "@/modules/provider/actions";
import { formatKobo } from "@/lib/money";
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
  const [paid, setPaid] = useState<number | null>(null);
  const [code, setCode] = useState("");
  const [showProblem, setShowProblem] = useState(false);
  const [problem, setProblem] = useState("");
  const [problemSent, setProblemSent] = useState(false);

  const run = (fn: () => Promise<void>) =>
    start(async () => {
      setError(null);
      try {
        await fn();
      } catch (e) {
        setError(e instanceof Error ? e.message : "That did not work");
      }
    });

  const submitCode = () =>
    start(async () => {
      setError(null);
      try {
        const { paidKobo } = await enterCodeAction(bookingId, code);
        setPaid(paidKobo);
      } catch (e) {
        setError(e instanceof Error ? e.message : "That code did not work");
      }
    });

  const submitProblem = () =>
    start(async () => {
      setError(null);
      try {
        await reportProblemAction(bookingId, problem);
        setProblemSent(true);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not send that");
      }
    });

  if (paid !== null) {
    return (
      <p className="mt-4 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-[color:var(--color-success)]">
        Done. {paid > 0 ? `${formatKobo(paid)} is on its way to your bank account.` : "This booking is complete."}
      </p>
    );
  }

  if (status === "completed") {
    return (
      <p className="mt-4 text-sm text-[color:var(--color-success)]">Completed and paid.</p>
    );
  }

  if (status === "disputed") {
    return (
      <p className="mt-4 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
        Nexa is looking into this booking. We&rsquo;ll be in touch.
      </p>
    );
  }

  return (
    <div className="mt-4 space-y-3">
      {status === "paid_held" ? (
        <div>
          <p className="mb-2 text-xs text-[color:var(--color-ink-muted)]">
            The customer has paid and Nexa is holding the whole amount. Accept it, do the job, and
            you get paid the moment you enter their code.
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

      {status === "accepted" || status === "in_progress" ? (
        <>
          {status === "accepted" ? (
            <Btn disabled={pending} onClick={() => run(() => startWorkAction(bookingId))}>
              Mark work started
            </Btn>
          ) : null}

          <div className="rounded-xl border border-[color:var(--color-line)] p-3">
            <p className="text-sm font-medium">Finished the job? Enter the customer&rsquo;s code.</p>
            <p className="mt-0.5 text-xs text-[color:var(--color-ink-muted)]">
              They give it to you when they&rsquo;re happy. Entering it pays you straight away.
            </p>
            <div className="mt-3 flex gap-2">
              <input
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="Their code"
                className="h-11 w-40 rounded-lg border border-[color:var(--color-line)] px-3 font-mono text-base tracking-widest outline-none focus:border-[color:var(--color-ink)]"
              />
              <Btn primary disabled={pending || code.trim().length === 0} onClick={submitCode}>
                Get paid
              </Btn>
            </div>
          </div>

          {!showProblem ? (
            <button
              type="button"
              onClick={() => setShowProblem(true)}
              className="text-xs text-[color:var(--color-ink-muted)] underline"
            >
              The customer won&rsquo;t give me the code
            </button>
          ) : problemSent ? (
            <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
              Thanks — Nexa has your report and will look into it. We may ask you for proof that you
              did the job.
            </p>
          ) : (
            <div className="rounded-xl border border-[color:var(--color-line)] p-3">
              <p className="text-sm font-medium">Tell Nexa what happened</p>
              <p className="mt-0.5 text-xs text-[color:var(--color-ink-muted)]">
                We&rsquo;ll contact the customer for the code. If they still refuse and you did the
                job, Nexa can pay you without it.
              </p>
              <textarea
                value={problem}
                onChange={(e) => setProblem(e.target.value)}
                rows={3}
                placeholder="What happened? Mention any proof you have — photos, messages, delivery notes."
                className="mt-2 w-full rounded-lg border border-[color:var(--color-line)] px-3 py-2 text-sm outline-none focus:border-[color:var(--color-ink)]"
              />
              <div className="mt-2 flex gap-2">
                <Btn primary disabled={pending || problem.trim().length < 10} onClick={submitProblem}>
                  Send to Nexa
                </Btn>
                <Btn disabled={pending} onClick={() => setShowProblem(false)}>
                  Cancel
                </Btn>
              </div>
            </div>
          )}
        </>
      ) : null}

      {error ? <p className="text-xs text-[color:var(--color-danger)]">{error}</p> : null}
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
        (primary
          ? "h-11 rounded-lg bg-[color:var(--color-ink)] px-4 text-sm font-medium text-white hover:opacity-90"
          : "h-11 rounded-lg border border-[color:var(--color-line)] px-4 text-sm font-medium hover:bg-[color:var(--color-surface-sunk)]") +
        " transition-[opacity,transform,background-color] duration-150 active:scale-[0.97] disabled:opacity-40 disabled:active:scale-100"
      }
    >
      {children}
    </button>
  );
}

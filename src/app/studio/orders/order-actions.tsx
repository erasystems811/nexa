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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

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
      <p className="mt-4 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
        Done. {paid > 0 ? `${formatKobo(paid)} is on its way to your bank account.` : "This booking is complete."}
      </p>
    );
  }

  if (status === "completed") {
    return <p className="mt-4 text-sm text-emerald-700">Completed and paid.</p>;
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
          <p className="mb-2 text-xs text-muted-foreground">
            The customer has paid and Nexa is holding the whole amount. Accept it, do the job, and you get paid the
            moment you enter their code.
          </p>
          <div className="flex gap-2">
            <Button disabled={pending} onClick={() => run(() => acceptOrderAction(bookingId))}>
              Accept booking
            </Button>
            <Button variant="outline" disabled={pending} onClick={() => run(() => rejectOrderAction(bookingId))}>
              Decline
            </Button>
          </div>
        </div>
      ) : null}

      {status === "accepted" || status === "in_progress" ? (
        <>
          {status === "accepted" ? (
            <Button variant="outline" disabled={pending} onClick={() => run(() => startWorkAction(bookingId))}>
              Mark work started
            </Button>
          ) : null}

          <div className="rounded-xl border p-3">
            <p className="text-sm font-medium">Finished the job? Enter the customer&rsquo;s code.</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              They give it to you when they&rsquo;re happy. Entering it pays you straight away.
            </p>
            <div className="mt-3 flex gap-2">
              <Input
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="Their code"
                className="w-40 font-mono tracking-widest"
              />
              <Button disabled={pending || code.trim().length === 0} onClick={submitCode}>
                Get paid
              </Button>
            </div>
          </div>

          {!showProblem ? (
            <button
              type="button"
              onClick={() => setShowProblem(true)}
              className="text-xs text-muted-foreground underline"
            >
              The customer won&rsquo;t give me the code
            </button>
          ) : problemSent ? (
            <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
              Thanks — Nexa has your report and will look into it. We may ask you for proof that you did the job.
            </p>
          ) : (
            <div className="rounded-xl border p-3">
              <p className="text-sm font-medium">Tell Nexa what happened</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                We&rsquo;ll contact the customer for the code. If they still refuse and you did the job, Nexa can
                pay you without it.
              </p>
              <Textarea
                value={problem}
                onChange={(e) => setProblem(e.target.value)}
                rows={3}
                placeholder="What happened? Mention any proof you have — photos, messages, delivery notes."
                className="mt-2"
              />
              <div className="mt-2 flex gap-2">
                <Button disabled={pending || problem.trim().length < 10} onClick={submitProblem}>
                  Send to Nexa
                </Button>
                <Button variant="outline" disabled={pending} onClick={() => setShowProblem(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </>
      ) : null}

      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}

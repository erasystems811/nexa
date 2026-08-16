"use client";

import { useActionState, useState } from "react";
import { payVendorAction, refundAction, overrideStatusAction, type AdminActionState } from "@/modules/admin/actions";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatKobo, koboToNaira } from "@/lib/money";

/**
 * THE core admin job: Nexa is holding the customer's money, the job is done, and
 * a person decides how much of it the vendor gets. The amount starts at
 * everything still held and can only be lowered — the server refuses anything
 * above it, and this form will not even offer it.
 */
export function PayVendor({
  bookingId,
  vendorPayKobo,
  nexaCommissionKobo,
  stillOwedVendorKobo,
  commissionPercent,
}: {
  bookingId: string;
  vendorPayKobo: number;
  nexaCommissionKobo: number;
  stillOwedVendorKobo: number;
  commissionPercent: number;
}) {
  const [state, action, pending] = useActionState(payVendorAction, {} as AdminActionState);
  const maxNaira = koboToNaira(stillOwedVendorKobo);
  const [naira, setNaira] = useState(String(Math.floor(maxNaira)));

  const entered = Number(naira);
  const tooMuch = Number.isFinite(entered) && entered > maxNaira;
  const alreadyPaidKobo = vendorPayKobo - stillOwedVendorKobo;

  return (
    <Card className="mt-4 border-accent">
      <CardContent className="pt-6">
        <h2 className="text-base font-semibold">Pay the vendor</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          This vendor&rsquo;s pay on this booking is <strong className="text-foreground">{formatKobo(vendorPayKobo)}</strong>
          {commissionPercent > 0 ? (
            <>
              {" "}
              &mdash; the customer&rsquo;s payment less Nexa&rsquo;s {commissionPercent}% commission of{" "}
              <strong className="text-foreground">{formatKobo(nexaCommissionKobo)}</strong>, which Nexa keeps.
            </>
          ) : (
            "."
          )}
          {alreadyPaidKobo > 0 ? ` You have already sent them ${formatKobo(alreadyPaidKobo)}.` : ""}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Send everything that&rsquo;s left, or part of it as a deposit before the job is done. The commission is
          never part of this.
        </p>

        <form action={action} className="mt-4 flex flex-wrap items-end gap-3">
          <input type="hidden" name="booking_id" value={bookingId} />
          <div>
            <Label htmlFor="pay-amount" className="text-xs">
              Amount to pay the vendor (₦)
            </Label>
            <Input
              id="pay-amount"
              name="amount"
              type="number"
              min="1"
              max={maxNaira}
              step="any"
              required
              value={naira}
              onChange={(e) => setNaira(e.target.value)}
              className="mt-1 h-11 w-48 tabular-nums"
            />
          </div>
          <Button type="submit" disabled={pending || tooMuch || entered <= 0}>
            {pending ? "Sending…" : "Release to vendor"}
          </Button>
        </form>

        {tooMuch ? (
          <p className="mt-2 text-xs text-destructive">
            The most you can pay this vendor now is {formatKobo(stillOwedVendorKobo)}. The rest is Nexa&rsquo;s commission.
          </p>
        ) : null}

        {state.error ? <p className="mt-3 text-sm text-destructive">{state.error}</p> : null}
        {state.ok ? <p className="mt-3 text-sm text-emerald-500">Sent to the vendor&rsquo;s bank account.</p> : null}
      </CardContent>
    </Card>
  );
}

/** Money back to the customer. Also capped at what Nexa is still holding. */
export function RefundCustomer({ bookingId, stillHeldKobo }: { bookingId: string; stillHeldKobo: number }) {
  const [state, action, pending] = useActionState(refundAction, {} as AdminActionState);

  return (
    <Card className="mt-3">
      <CardContent className="pt-6">
        <h2 className="text-sm font-semibold">Refund the customer</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Sends money back from what Nexa is holding — at most {formatKobo(stillHeldKobo)}.
        </p>
        <form action={action} className="mt-3 flex flex-wrap items-end gap-2">
          <input type="hidden" name="booking_id" value={bookingId} />
          <div>
            <Label htmlFor="refund-amount" className="text-xs">
              Amount (₦)
            </Label>
            <Input
              id="refund-amount"
              name="amount"
              type="number"
              min="1"
              max={koboToNaira(stillHeldKobo)}
              step="any"
              required
              className="mt-1 h-10 w-32 tabular-nums"
            />
          </div>
          <Input name="reason" placeholder="Why?" required className="h-10 flex-1" />
          <Button type="submit" variant="outline" disabled={pending}>
            {pending ? "Refunding…" : "Refund"}
          </Button>
        </form>
        {state.error ? <p className="mt-2 text-sm text-destructive">{state.error}</p> : null}
        {state.ok ? <p className="mt-2 text-sm text-emerald-500">Sent back to the customer.</p> : null}
      </CardContent>
    </Card>
  );
}

const STATUSES = ["paid_held", "accepted", "in_progress", "completed", "cancelled", "disputed"];

/** A blunt instrument, kept out of the way. It moves no money. */
export function ChangeStatus({ bookingId }: { bookingId: string }) {
  const [state, action, pending] = useActionState(overrideStatusAction, {} as AdminActionState);

  return (
    <Card className="mt-3">
      <CardContent className="pt-6">
        <h2 className="text-sm font-semibold">Change the booking status by hand</h2>
        <p className="mt-1 text-xs text-muted-foreground">Only use this when something went wrong. It changes the booking, not the money.</p>
        <form action={action} className="mt-3 flex flex-wrap items-end gap-2">
          <input type="hidden" name="booking_id" value={bookingId} />
          <select name="status" className="flex h-10 rounded-md border border-input bg-transparent px-3 text-sm outline-none focus-visible:ring-1 focus-visible:ring-ring">
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s.replace(/_/g, " ")}
              </option>
            ))}
          </select>
          <Input name="reason" placeholder="Why?" required className="h-10 flex-1" />
          <Button type="submit" variant="outline" disabled={pending}>
            {pending ? "Changing…" : "Change"}
          </Button>
        </form>
        {state.error ? <p className="mt-2 text-sm text-destructive">{state.error}</p> : null}
        {state.ok ? <p className="mt-2 text-sm text-emerald-500">Changed.</p> : null}
      </CardContent>
    </Card>
  );
}

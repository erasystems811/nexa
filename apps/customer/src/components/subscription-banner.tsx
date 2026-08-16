import { formatKobo } from "@/lib/money";

/**
 * Shown in Business Studio when the vendor has stopped paying the monthly fee.
 *
 * Their listings are already gone from the marketplace at this point — RLS
 * hides them. The point of this banner is that the vendor should never have to
 * guess why their leads stopped: it says what happened, what it costs, and what
 * to do. Studio itself keeps working, so nobody is locked out of a booking they
 * have already been paid a deposit for.
 */
export function SubscriptionBanner({
  status,
  amountKobo,
}: {
  status: string;
  amountKobo: number;
}) {
  if (status === "active" || status === "trialing") return null;

  const lapsed = status === "past_due";

  return (
    <div className="mb-5 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3">
      <p className="text-sm font-medium text-amber-900">
        {lapsed
          ? "Your listings are hidden from customers"
          : "Your subscription is cancelled"}
      </p>
      <p className="mt-1 text-xs text-amber-900/80">
        {lapsed
          ? `Your monthly fee of ${formatKobo(amountKobo)} has not been paid, so customers cannot find you in search right now. Pay it and your listings go straight back up.`
          : "Customers cannot find you in search. Talk to Nexa to start your subscription again."}{" "}
        Your existing bookings are unaffected — you keep full access here.
      </p>
    </div>
  );
}

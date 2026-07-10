"use client";

import Link from "next/link";
import { useTransition } from "react";
import { acceptOfferAction, sendOfferAction } from "@/modules/bookings/actions";
import { formatKobo } from "@/lib/money";

interface Offer {
  id: string;
  amount_kobo: number;
  status: string;
  created_at: string;
}

/**
 * Negotiation, inside the conversation. PRD Section 08: "a booking is created
 * only once a final price is agreed."
 *
 * The provider quotes; the customer accepts. A provider cannot accept their own
 * quote — the database refuses (guard_price_offer_write, 0016).
 */
export function Offers({
  conversationId,
  listingId,
  viewerIsProvider,
  offers,
}: {
  conversationId: string;
  listingId: string | null;
  viewerIsProvider: boolean;
  offers: Offer[];
}) {
  const [pending, startTransition] = useTransition();

  if (!listingId) return null;

  const accepted = offers.find((o) => o.status === "accepted");
  const live = offers.find((o) => o.status === "pending");

  return (
    <section className="border-b border-[color:var(--color-line)] bg-[color:var(--color-surface-sunk)] px-5 py-4">
      {accepted ? (
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs text-[color:var(--color-ink-muted)]">Agreed price</p>
            <p className="text-lg font-semibold tabular-nums">
              {formatKobo(accepted.amount_kobo)}
            </p>
          </div>
          {!viewerIsProvider ? (
            <Link
              href={`/book/${listingId}`}
              className="rounded-full bg-[color:var(--color-ink)] px-5 py-2.5 text-sm font-medium text-white"
            >
              Book at this price
            </Link>
          ) : null}
        </div>
      ) : live ? (
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs text-[color:var(--color-ink-muted)]">
              {viewerIsProvider ? "Your offer" : "Offer from the provider"}
            </p>
            <p className="text-lg font-semibold tabular-nums">{formatKobo(live.amount_kobo)}</p>
          </div>
          {!viewerIsProvider ? (
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  await acceptOfferAction(live.id, conversationId);
                })
              }
              className="rounded-full bg-[color:var(--color-ink)] px-5 py-2.5 text-sm font-medium text-white disabled:opacity-40"
            >
              {pending ? "Accepting…" : "Accept price"}
            </button>
          ) : (
            <p className="text-xs text-[color:var(--color-ink-muted)]">Waiting for the customer</p>
          )}
        </div>
      ) : viewerIsProvider ? (
        <form action={sendOfferAction} className="flex items-end gap-2">
          <input type="hidden" name="conversationId" value={conversationId} />
          <label className="flex-1">
            <span className="mb-1 block text-xs text-[color:var(--color-ink-muted)]">
              Send a price (₦)
            </span>
            <input
              name="amount"
              type="number"
              min="1"
              step="any"
              required
              className="h-10 w-full rounded-lg border border-[color:var(--color-line)] px-3 text-sm tabular-nums outline-none focus:border-[color:var(--color-ink)]"
            />
          </label>
          <button
            type="submit"
            className="h-10 rounded-lg bg-[color:var(--color-ink)] px-4 text-sm font-medium text-white"
          >
            Send offer
          </button>
        </form>
      ) : (
        <p className="text-xs text-[color:var(--color-ink-muted)]">
          This listing is priced on request. The provider will send you a price here.
        </p>
      )}
    </section>
  );
}

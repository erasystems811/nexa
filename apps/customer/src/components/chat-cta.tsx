import Link from "next/link";
import type { Route } from "next";
import { discussListingAction } from "@/modules/bookings/actions";
import { discussProviderAction } from "@/modules/messaging/actions";
import { Button } from "@/components/ui/button";

/**
 * "Chat on WhatsApp" — the button that used to be hidden.
 *
 * It was called "Request price" and it only ever appeared on a negotiable
 * listing, so on a fixed-price listing, and on a vendor's whole profile, there
 * was no way to say a word to anybody. It now sits on every listing and every
 * vendor page, next to "Book this".
 *
 * Both forms post to a server action, which opens the conversation and sends the
 * customer to /whatsapp/[id] — the handoff that deep-links to NEXA's WhatsApp
 * number, never the vendor's. Signed out, the button is still there and takes
 * them to sign in; hiding it was how the whole feature disappeared.
 */

export function ChatOnWhatsApp({
  listingId,
  providerId,
  signedIn,
  next,
  variant = "outline",
  label = "Chat on WhatsApp",
}: {
  /** Chat about one listing. */
  listingId?: string;
  /** Chat about the business itself — used on the vendor page. */
  providerId?: string;
  signedIn: boolean;
  /** Where to come back to after signing in. */
  next: string;
  variant?: "default" | "outline";
  /** e.g. "Invite to your event" for a self-serve vendor's only CTA — see VENDOR_TIERS. */
  label?: string;
}) {
  if (!signedIn) {
    return (
      <Link href={`/login?next=${encodeURIComponent(next)}` as Route} className="block">
        <Button variant={variant} className="w-full" type="button">
          {label}
        </Button>
      </Link>
    );
  }

  if (listingId) {
    return (
      <form action={discussListingAction}>
        <input type="hidden" name="listingId" value={listingId} />
        <Button type="submit" variant={variant} className="w-full">
          {label}
        </Button>
      </form>
    );
  }

  return (
    <form action={discussProviderAction}>
      <input type="hidden" name="providerId" value={providerId ?? ""} />
      <Button type="submit" variant={variant} className="w-full">
        {label}
      </Button>
    </form>
  );
}

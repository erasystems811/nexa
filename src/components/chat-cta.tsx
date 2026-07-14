import Link from "next/link";
import type { Route } from "next";
import { discussListingAction } from "@/modules/bookings/actions";
import { discussProviderAction } from "@/modules/messaging/actions";
import { Button } from "@/components/ui";

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

/** The promise the product is built on, said out loud. Nothing else was saying it. */
export function PrivacyNote({ className }: { className?: string }) {
  return (
    <p className={`text-center text-xs text-[color:var(--color-ink-muted)] ${className ?? ""}`}>
      You chat through Nexa&rsquo;s WhatsApp number. You never see their number, and they never see
      yours.
    </p>
  );
}

export function ChatOnWhatsApp({
  listingId,
  providerId,
  signedIn,
  next,
  variant = "ghost",
}: {
  /** Chat about one listing. */
  listingId?: string;
  /** Chat about the business itself — used on the vendor page. */
  providerId?: string;
  signedIn: boolean;
  /** Where to come back to after signing in. */
  next: string;
  variant?: "primary" | "ghost";
}) {
  if (!signedIn) {
    return (
      <Link href={`/login?next=${encodeURIComponent(next)}` as Route} className="block">
        <Button variant={variant} className="w-full" type="button">
          Chat on WhatsApp
        </Button>
      </Link>
    );
  }

  if (listingId) {
    return (
      <form action={discussListingAction}>
        <input type="hidden" name="listingId" value={listingId} />
        <Button type="submit" variant={variant} className="w-full">
          Chat on WhatsApp
        </Button>
      </form>
    );
  }

  return (
    <form action={discussProviderAction}>
      <input type="hidden" name="providerId" value={providerId ?? ""} />
      <Button type="submit" variant={variant} className="w-full">
        Chat on WhatsApp
      </Button>
    </form>
  );
}

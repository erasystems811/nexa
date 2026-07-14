import Link from "next/link";
import type { Route } from "next";
import { getSession } from "@/modules/auth";
import { myApplication } from "@/modules/provider";
import { Logo } from "@/components/logo";
import { Button, Card } from "@/components/ui";

/**
 * What someone sees when they land on the vendor surface without being a vendor.
 *
 * This used to silently redirect them to whatever their own role's home was —
 * so signing in as an admin and typing /vendor dropped you in the Admin Console
 * with no explanation. There was also nowhere to go and ask to become a vendor,
 * because that page did not exist. Both of those made the vendor side of Nexa
 * look broken when it was only unreachable.
 */
export default async function VendorAccessPage() {
  const session = await getSession();

  // Somebody who already applied must not be told to apply. They handed over
  // their CAC and their NIN; being asked to do it again is how a vendor decides
  // Nexa is not serious.
  const application = session ? await myApplication(session.userId) : null;

  const waiting = application?.status === "pending";
  const turnedDown = application?.status === "rejected";

  return (
    <main className="flex min-h-dvh flex-col justify-center px-3 py-8">
      <div className="mx-auto w-full max-w-md rounded-[1.75rem] border border-[color:var(--color-line)] bg-white px-6 py-10 shadow-card">
      {/* The mark, but not a link. This is the vendor surface; there is nothing
          on the customer site a vendor came here to reach. */}
      <span className="mb-8 flex justify-center" aria-label="Nexa for vendors">
        <Logo label="Nexa for vendors" markClassName="size-12 rounded-2xl" textClassName="text-lg" />
      </span>

      <Card>
        <h1 className="text-lg font-semibold">Nexa for vendors</h1>
        <p className="mt-2 text-sm text-[color:var(--color-ink-muted)]">
          This is where vendors manage their listings, bookings and payouts.
        </p>

        {waiting ? (
          <p className="mt-3 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
            <strong>Your application is with us.</strong> Someone is looking at your business and
            the identification you sent. The moment you are approved, this page becomes your
            Business Studio — nothing more is needed from you.
          </p>
        ) : turnedDown ? (
          <p className="mt-3 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
            Your application was not accepted. If you think that is wrong, or you have better
            documents to send, email Nexa.
          </p>
        ) : session ? (
          <p className="mt-3 rounded-xl bg-[color:var(--color-surface-sunk)] px-4 py-3 text-xs text-[color:var(--color-ink-muted)]">
            You are signed in as <strong className="text-[color:var(--color-ink)]">{session.email}</strong>,
            which is not a vendor account. Sign in with your vendor account to continue.
          </p>
        ) : null}

        <div className="mt-6 space-y-3">
          {!waiting && !turnedDown ? (
            <>
              <Link href={"/login" as Route} className="block">
                <Button className="w-full">{session ? "Sign in as a vendor" : "Sign in"}</Button>
              </Link>

              <Link href={"/apply" as Route} className="block">
                <Button variant="ghost" className="w-full">
                  Apply to become a vendor
                </Button>
              </Link>
            </>
          ) : null}
        </div>

        {!waiting && !turnedDown ? (
          <p className="mt-4 text-center text-xs text-[color:var(--color-ink-muted)]">
            Applications are reviewed by Nexa. We&rsquo;ll email you once you&rsquo;re approved.
          </p>
        ) : null}
      </Card>
    </div>
    </main>
  );
}

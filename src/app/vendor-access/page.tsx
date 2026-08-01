import Link from "next/link";
import type { Route } from "next";
import { getSession } from "@/modules/auth";
import { myApplication } from "@/modules/provider";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

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
    <div className="mx-auto max-w-md">
      <Card>
        <CardContent className="pt-6">
          <h1 className="font-serif text-lg font-semibold">Nexa for vendors</h1>
          <p className="mt-2 text-sm text-muted-foreground">
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
            <p className="mt-3 rounded-xl bg-muted px-4 py-3 text-xs text-muted-foreground">
              You are signed in as <strong className="text-foreground">{session.email}</strong>,
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
            <p className="mt-4 text-center text-xs text-muted-foreground">
              Applications are reviewed by Nexa. We&rsquo;ll email you once you&rsquo;re approved.
            </p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}

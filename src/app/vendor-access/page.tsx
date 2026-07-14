import Link from "next/link";
import type { Route } from "next";
import { getSession } from "@/modules/auth";
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

  return (
    <main className="flex min-h-dvh flex-col justify-center px-3 py-8">
      <div className="mx-auto w-full max-w-md rounded-[1.75rem] border border-[color:var(--color-line)] bg-white px-6 py-10 shadow-card">
      <Link href="/" aria-label="Nexa home" className="mb-8 self-center">
        <Logo markClassName="size-12 rounded-2xl" textClassName="text-lg" />
      </Link>

      <Card>
        <h1 className="text-lg font-semibold">Nexa for vendors</h1>
        <p className="mt-2 text-sm text-[color:var(--color-ink-muted)]">
          This is where vendors manage their listings, bookings and payouts.
          {session
            ? " Your account isn't a vendor account yet."
            : " Sign in with your vendor account to continue."}
        </p>

        <div className="mt-6 space-y-3">
          {!session ? (
            <Link href={"/login" as Route} className="block">
              <Button className="w-full">Sign in</Button>
            </Link>
          ) : null}

          <Link href={"/apply" as Route} className="block">
            <Button variant={session ? "primary" : "ghost"} className="w-full">
              Apply to become a vendor
            </Button>
          </Link>
        </div>

        <p className="mt-4 text-center text-xs text-[color:var(--color-ink-muted)]">
          Applications are reviewed by Nexa. We&rsquo;ll email you once you&rsquo;re approved.
        </p>
      </Card>

      <Link
        href={"/" as Route}
        className="mt-6 text-center text-xs text-[color:var(--color-ink-muted)] hover:text-[color:var(--color-ink)]"
      >
        &larr; Back to Nexa
      </Link>
    </div>
    </main>
  );
}

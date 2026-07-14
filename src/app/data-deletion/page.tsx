import Link from "next/link";
import type { Route } from "next";
import type { Metadata } from "next";
import { Logo } from "@/components/logo";
import { Card } from "@/components/ui";

export const metadata: Metadata = {
  title: "Delete your data - Nexa",
  description: "How to have your Nexa account and personal data deleted.",
};

const CONTACT = "chidera@erasystems.com.ng";

/**
 * Meta requires a public, reachable URL explaining how someone gets their data
 * deleted, before it will let an app go live.
 */
export default function DataDeletionPage() {
  return (
    <main className="mx-auto max-w-2xl px-5 pb-20">
      <header className="py-6">
        <Link href={"/" as Route} aria-label="Nexa home">
          <Logo markClassName="size-10 rounded-[1.1rem]" textClassName="text-lg" />
        </Link>
      </header>

      <h1 className="text-3xl font-semibold tracking-tight">Delete your data</h1>

      <div className="mt-8 space-y-8 text-[15px] leading-relaxed">
        <section>
          <p>
            You can ask Nexa to delete your account and the personal data we hold about you, at any
            time, and we will do it.
          </p>
        </section>

        <Card>
          <h2 className="text-sm font-semibold">How to ask</h2>
          <p className="mt-2 text-sm">
            Email{" "}
            <a href={`mailto:${CONTACT}?subject=Delete%20my%20data`} className="underline">
              {CONTACT}
            </a>{" "}
            from the email address on your Nexa account, with the subject line:
          </p>
          <p className="mt-3 rounded-lg bg-[color:var(--color-surface-sunk)] px-4 py-3 font-mono text-sm">
            Delete my data
          </p>
          <p className="mt-3 text-sm text-[color:var(--color-ink-muted)]">
            We ask you to send it from your account&rsquo;s email address so that nobody else can
            delete your account on your behalf.
          </p>
        </Card>

        <section>
          <h2 className="text-lg font-semibold">What gets deleted</h2>
          <ul className="mt-2 space-y-2">
            {[
              "Your account and login.",
              "Your name, email address and phone number.",
              "Your WhatsApp number and the messages you sent through Nexa.",
              "If you are a vendor: your business profile, your listings, and your identification documents.",
            ].map((item) => (
              <li key={item} className="flex gap-2">
                <span className="mt-[0.55rem] size-1 shrink-0 rounded-full bg-[color:var(--color-ink-muted)]" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold">What we have to keep</h2>
          <p>
            Records of bookings and payments that actually happened — what was paid, to whom, and
            when. We are required to keep financial records, and a record of money that moved cannot
            honestly be erased on request.
          </p>
          <p className="mt-3">
            We will tell you exactly what was kept and why. Nothing kept is used to contact you or to
            market to you.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold">How long it takes</h2>
          <p>We respond within 30 days, and usually much sooner.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold">Open bookings</h2>
          <p>
            If you have a booking that has been paid for but not finished, we will settle it first —
            completed, cancelled, or refunded — before deleting your account. We are holding
            somebody&rsquo;s money, and it has to go to the right place.
          </p>
        </section>
      </div>

      <footer className="mt-14 border-t border-[color:var(--color-line)] pt-6 text-xs text-[color:var(--color-ink-muted)]">
        <Link href={"/" as Route} className="underline">
          Back to Nexa
        </Link>
        <span className="mx-2">·</span>
        <Link href={"/privacy" as Route} className="underline">
          Privacy Policy
        </Link>
        <span className="mx-2">·</span>
        <Link href={"/terms" as Route} className="underline">
          Terms of Service
        </Link>
      </footer>
    </main>
  );
}

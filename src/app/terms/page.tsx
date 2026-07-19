import Link from "next/link";
import type { Route } from "next";
import type { Metadata } from "next";
import { Logo } from "@/components/logo";

export const metadata: Metadata = {
  title: "Terms of Service - Nexa",
  description: "The rules for using Nexa, for customers and for vendors.",
};

const UPDATED = "14 July 2026";
const CONTACT = "hello@erasystems.com.ng";

export default function TermsPage() {
  return (
    <main className="mx-auto max-w-2xl px-5 pb-20">
      <header className="py-6">
        <Link href={"/" as Route} aria-label="Nexa home">
          <Logo markClassName="size-10 rounded-[1.1rem]" textClassName="text-lg" />
        </Link>
      </header>

      <h1 className="text-3xl font-semibold tracking-tight">Terms of Service</h1>
      <p className="mt-2 text-sm text-[color:var(--color-ink-muted)]">Last updated {UPDATED}</p>

      <div className="mt-8 space-y-8 text-[15px] leading-relaxed">
        <section>
          <p>
            Nexa is operated by <strong>ERA Systems</strong>. By using Nexa you agree to these
            terms. If you do not, please do not use it.
          </p>
        </section>

        <Section title="What Nexa is">
          <p>
            Nexa is a marketplace. It helps you find event vendors, talk to them, and pay them
            safely. Nexa is <strong>not</strong> the vendor. The person who caters your event,
            plays at it, photographs it or moves your equipment is an independent business, and they
            — not Nexa — are responsible for doing the job they agreed to do.
          </p>
        </Section>

        <Section title="How the money works">
          <p>This is the most important part, so it is written plainly.</p>
          <List
            items={[
              "You pay Nexa, not the vendor. Nexa holds the whole amount.",
              "The vendor does the job.",
              "When you are satisfied, you give the vendor your completion code. That code is proof the job was done.",
              "Nexa then pays the vendor. A vendor cannot be paid by claiming the job is finished — only your code, or a decision by Nexa, releases the money.",
              "If the vendor declines the booking, you are refunded in full, automatically.",
            ]}
          />
          <p className="mt-3">
            Never pay a vendor outside Nexa. If you do, the money is gone and there is nothing we
            can do for you. That is why Nexa blocks attempts to share bank details or arrange
            payment off the platform.
          </p>
        </Section>

        <Section title="Cancellations and refunds">
          <p>
            Before a vendor accepts your booking, you can cancel for a full refund. After they
            accept, the vendor&rsquo;s own cancellation policy applies — it is shown on their
            listing before you pay.
          </p>
          <p className="mt-3">
            If something goes wrong — the vendor does not turn up, or the service is not what was
            agreed — contact Nexa. We are holding the money, and we will look at what happened
            before we release it.
          </p>
        </Section>

        <Section title="If you are a vendor">
          <List
            items={[
              "Tell the truth. Your business name, your identification, your listings, your prices and your photos must be real and yours.",
              "Turn up and do the job you listed, at the standard you described.",
              "Do not take customers off Nexa. Asking a customer to pay you directly is a breach of these terms and will get you removed. It also leaves the customer with no protection, which is the thing Nexa exists to prevent.",
              "Nexa reviews every vendor before they go live, and every listing before it is published. We may suspend or remove a vendor at any time.",
            ]}
          />
        </Section>

        <Section title="Messages">
          <p>
            Customers and vendors talk through Nexa&rsquo;s WhatsApp number. Neither side sees the
            other&rsquo;s number. Messages are scanned, and phone numbers, bank account numbers and
            off-platform payment requests are blocked.
          </p>
        </Section>

        <Section title="What Nexa is not responsible for">
          <p>
            Nexa is responsible for running the platform and for handling your money honestly. Nexa
            is not responsible for the quality of a vendor&rsquo;s work, for what happens at your
            event, or for any agreement you reach with a vendor outside Nexa.
          </p>
          <p className="mt-3">
            Nothing in these terms removes any right you have under Nigerian law.
          </p>
        </Section>

        <Section title="Closing your account">
          <p>
            You can close your account at any time — see the{" "}
            <Link href={"/privacy" as Route} className="underline">
              Privacy Policy
            </Link>
            . Bookings already paid for must be completed, cancelled or refunded first.
          </p>
        </Section>

        <Section title="Changes">
          <p>
            We may update these terms. If we change something that matters, we will say so on this
            page and update the date at the top.
          </p>
        </Section>

        <Section title="Contact">
          <p>
            <a href={`mailto:${CONTACT}`} className="underline">
              {CONTACT}
            </a>
          </p>
        </Section>
      </div>

      <footer className="mt-14 border-t border-[color:var(--color-line)] pt-6 text-xs text-[color:var(--color-ink-muted)]">
        <Link href={"/" as Route} className="underline">
          Back to Nexa
        </Link>
        <span className="mx-2">·</span>
        <Link href={"/privacy" as Route} className="underline">
          Privacy Policy
        </Link>
      </footer>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-lg font-semibold">{title}</h2>
      <div className="mt-2 space-y-2">{children}</div>
    </section>
  );
}

function List({ items }: { items: string[] }) {
  return (
    <ul className="mt-2 space-y-2">
      {items.map((item) => (
        <li key={item} className="flex gap-2">
          <span className="mt-[0.55rem] size-1 shrink-0 rounded-full bg-[color:var(--color-ink-muted)]" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

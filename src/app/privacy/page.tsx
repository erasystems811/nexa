import Link from "next/link";
import type { Route } from "next";
import type { Metadata } from "next";
import { Logo } from "@/components/logo";

export const metadata: Metadata = {
  title: "Privacy Policy - Nexa",
  description: "What Nexa collects, why, who it is shared with, and how to get it deleted.",
};

const UPDATED = "14 July 2026";
const CONTACT = "hello@erasystems.com.ng";

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-2xl px-5 pb-20">
      <header className="py-6">
        <Link href={"/" as Route} aria-label="Nexa home">
          <Logo markClassName="size-10 rounded-[1.1rem]" textClassName="text-lg" />
        </Link>
      </header>

      <h1 className="text-3xl font-semibold tracking-tight">Privacy Policy</h1>
      <p className="mt-2 text-sm text-[color:var(--color-ink-muted)]">Last updated {UPDATED}</p>

      <div className="mt-8 space-y-8 text-[15px] leading-relaxed">
        <section>
          <p>
            Nexa is an event services marketplace operated by <strong>ERA Systems</strong>. It
            connects customers with verified vendors — caterers, DJs, photographers, decorators,
            transport companies and others — and holds the customer&rsquo;s payment until the job is
            done.
          </p>
          <p className="mt-3">
            This policy explains, in plain terms, what we collect, why we collect it, who else sees
            it, and how you get it removed. It applies to nexa.erasystems.com.ng and to the WhatsApp
            number Nexa uses to pass messages between customers and vendors.
          </p>
        </section>

        <Section title="What we collect">
          <H3>If you are a customer</H3>
          <List
            items={[
              "Your name, email address and phone number, when you create an account.",
              "Your bookings: what you booked, from whom, when, where, and what you paid.",
              "Messages you send through Nexa, including on WhatsApp (see below).",
              "Payment records — the amount, the reference, and whether it succeeded. We do not store your card details; those go directly to our payment processor.",
            ]}
          />

          <H3>If you are a vendor</H3>
          <List
            items={[
              "Your business name, phone number, email address, the service you offer, your city, and a description of your business.",
              "A means of identification — CAC certificate, NIN, BVN, international passport or driver's licence — including the number and a photo of the document. We ask for this because customers are trusting strangers with money and with their event, and verification is what makes that reasonable.",
              "Your bank account details, so we can pay you.",
              "Your listings, bookings, reviews, and messages.",
            ]}
          />

          <H3>WhatsApp messages</H3>
          <p>
            Customers and vendors never exchange phone numbers on Nexa. Both sides message{" "}
            <strong>Nexa&rsquo;s</strong> WhatsApp number, and Nexa passes the message on. To do
            that we store your WhatsApp number, your WhatsApp display name, and the content of the
            messages you send through us, linked to the booking they are about.
          </p>
          <p className="mt-3">
            We scan those messages for phone numbers, bank account numbers, and requests to pay
            outside Nexa — and we block them. This protects both sides: a payment made outside Nexa
            has no protection if the job is never done.
          </p>
        </Section>

        <Section title="Why we collect it">
          <List
            items={[
              "To run the marketplace — to show you vendors, take bookings, and let the two of you talk.",
              "To hold and release money safely. This is the core of Nexa, and it needs a record of who paid what, for what, and whether it was delivered.",
              "To verify that vendors are real. That is what the ID document is for, and nothing else.",
              "To keep both sides safe — blocking off-platform payment attempts, and investigating complaints.",
              "To meet legal and financial record-keeping obligations.",
            ]}
          />
          <p className="mt-3">
            We do not sell your data. We do not use it for advertising, and we do not share it with
            advertisers.
          </p>
        </Section>

        <Section title="Who else sees it">
          <p>Nexa runs on other companies&rsquo; infrastructure. Each sees only what it needs to:</p>
          <List
            items={[
              "Supabase — our database and login system. It holds your account and your bookings.",
              "Railway — hosts the application.",
              "Flutterwave — processes payments. Your card details go to them, not to us.",
              "Meta (WhatsApp) — delivers the messages between you and Nexa.",
              "Resend — sends our emails, such as verification codes and vendor invitations.",
            ]}
          />
          <p className="mt-3">
            We may also disclose information where the law requires it, or where it is necessary to
            investigate fraud or a dispute over a booking.
          </p>
        </Section>

        <Section title="What the other side sees">
          <p>
            A vendor sees your name and what you booked. They do <strong>not</strong> see your phone
            number, your email address, or your payment details. You do not see theirs. That is
            deliberate, and it is enforced by the system, not by policy alone.
          </p>
        </Section>

        <Section title="How long we keep it">
          <p>
            Account and profile information is kept while your account exists. Booking and payment
            records are kept for as long as we are required to keep financial records, even after an
            account is closed — a record of money that moved cannot honestly be erased on request.
            Identification documents are kept while a vendor is active on Nexa, and deleted when
            they leave.
          </p>
        </Section>

        <Section title="Your rights">
          <p>
            Under the Nigeria Data Protection Act, you may ask us to show you the personal data we
            hold about you, correct it if it is wrong, delete it, or stop using it in a particular
            way. You may also withdraw consent for WhatsApp messaging at any time — though you will
            no longer be able to talk to vendors through Nexa if you do.
          </p>
          <p className="mt-3">
            To exercise any of these, email{" "}
            <a href={`mailto:${CONTACT}`} className="underline">
              {CONTACT}
            </a>
            . We will respond within 30 days.
          </p>
        </Section>

        <Section title="Deleting your data">
          <p>
            Email{" "}
            <a href={`mailto:${CONTACT}`} className="underline">
              {CONTACT}
            </a>{" "}
            from the address on your account, with the subject line <strong>Delete my data</strong>.
            We will delete your account, your profile, your messages and — for vendors — your
            identification documents.
          </p>
          <p className="mt-3">
            We will keep records of completed bookings and payments where the law requires it. We
            will tell you exactly what was kept and why.
          </p>
        </Section>

        <Section title="Children">
          <p>Nexa is not for anyone under 18, and we do not knowingly collect their data.</p>
        </Section>

        <Section title="Changes">
          <p>
            If we change this policy in a way that matters, we will say so on this page and update
            the date at the top.
          </p>
        </Section>

        <Section title="Contact">
          <p>
            Nexa is operated by <strong>ERA Systems</strong>.
            <br />
            Email:{" "}
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
        <Link href={"/terms" as Route} className="underline">
          Terms of Service
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

function H3({ children }: { children: React.ReactNode }) {
  return <h3 className="mt-4 text-sm font-semibold">{children}</h3>;
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

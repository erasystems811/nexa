import { getSession } from "@/modules/auth";
import { ContactForm } from "./contact-form";
import { Card, PageHeader } from "@/components/ui";
import { BackBar } from "@/components/back-bar";

export default async function ContactPage() {
  const session = await getSession();

  return (
    <main className="mx-auto max-w-xl px-5 py-10">
      <BackBar fallback="/" className="mb-4" />
      <PageHeader
        title="Contact Nexa"
        subtitle="A question, a problem, or something that doesn't fit anywhere else - tell us and someone will get back to you."
      />

      <Card>
        <ContactForm
          defaultName={session?.profile.full_name ?? ""}
          defaultContact={session?.profile.phone ?? session?.email ?? ""}
        />
      </Card>

      <p className="mt-6 text-center text-xs text-[color:var(--color-ink-muted)]">
        You can also reach us directly at{" "}
        <a href="mailto:hello@erasystems.com.ng" className="underline">
          hello@erasystems.com.ng
        </a>
        .
      </p>
    </main>
  );
}

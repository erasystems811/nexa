import { notFound } from "next/navigation";
import { requireSession } from "@/modules/auth";
import { getConversation } from "@/modules/messaging";
import { publicEnv } from "@/lib/env";
import { toWhatsAppNumber } from "@/lib/phone";
import { Button, Card, PageHeader } from "@/components/ui";
import { BackBar } from "@/components/back-bar";

/**
 * The handoff to WhatsApp.
 *
 * The customer messages NEXA's own WhatsApp — a real WhatsApp Business inbox on a
 * phone Nexa runs, not the customer's and not the vendor's. Nexa reads it there
 * and coordinates with the vendor. Neither side ever holds the other's number,
 * which is the whole point: the payment, the code and the protection all stay
 * inside Nexa.
 *
 * The pre-filled message carries what a human at Nexa actually needs to help —
 * the vendor and the service — not a database id nobody can read.
 */
export default async function WhatsappHandoffPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireSession();

  const conversation = await getConversation(id);
  if (!conversation) notFound();

  const vendorName =
    (conversation.providers as unknown as { business_name: string } | null)?.business_name ?? null;
  const listingTitle =
    (conversation.listings as unknown as { title: string } | null)?.title ?? null;

  const ref = id.slice(0, 8).toUpperCase();
  const about = listingTitle
    ? `"${listingTitle}"${vendorName ? ` from ${vendorName}` : ""}`
    : vendorName ?? "an event service";
  const message = `Hi Nexa! I'd like to book ${about}. (Ref ${ref})`;

  // Normalised, not trusted: a number typed the way Nigerians say it (08022748369)
  // builds a wa.me link that goes nowhere.
  const number = toWhatsAppNumber(publicEnv.NEXT_PUBLIC_WHATSAPP_NUMBER);
  const href = number
    ? `https://wa.me/${number}?text=${encodeURIComponent(message)}`
    : null;

  return (
    <main className="mx-auto max-w-xl px-5 py-10">
      <BackBar fallback="/" className="mb-4" />
      <PageHeader
        title="Chat on WhatsApp"
        subtitle="You message Nexa, and Nexa sorts it out with the vendor. You never deal with a stranger, and your money is protected until the job is done."
      />

      <Card>
        <p className="text-sm text-[color:var(--color-ink-muted)]">
          Tap below to open WhatsApp. Your message is already written — just send it, and someone
          at Nexa will help you book{" "}
          <strong className="text-[color:var(--color-ink)]">{vendorName ?? "this vendor"}</strong>.
        </p>

        {href ? (
          <a href={href} className="mt-5 block">
            <Button className="w-full">Chat on WhatsApp</Button>
          </a>
        ) : (
          <p className="mt-5 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
            WhatsApp isn&rsquo;t set up yet. Please try again shortly, or contact Nexa support.
          </p>
        )}
      </Card>
    </main>
  );
}

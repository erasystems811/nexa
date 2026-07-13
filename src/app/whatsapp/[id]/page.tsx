import { notFound } from "next/navigation";
import { requireSession } from "@/modules/auth";
import { getConversation } from "@/modules/messaging";
import { publicEnv } from "@/lib/env";
import { Button, Card, PageHeader } from "@/components/ui";

export default async function WhatsappHandoffPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireSession();

  const conversation = await getConversation(id);
  if (!conversation) notFound();

  const number = publicEnv.NEXT_PUBLIC_WHATSAPP_NUMBER;
  const message = `Hi Nexa, I want to continue my booking conversation. Ref: ${id}`;
  const href = number
    ? `https://wa.me/${number.replace(/\D/g, "")}?text=${encodeURIComponent(message)}`
    : null;

  return (
    <main className="mx-auto max-w-xl px-5 py-10">
      <PageHeader
        title="Continue on WhatsApp"
        subtitle="Both sides chat with Nexa&rsquo;s WhatsApp number. Nexa relays the messages and keeps escrow protected."
      />

      <Card>
        <h2 className="text-sm font-medium">How this works</h2>
        <ol className="mt-3 space-y-2 text-sm text-[color:var(--color-ink-muted)]">
          <li>1. You message Nexa on WhatsApp with this conversation reference.</li>
          <li>2. Nexa sends the message to the vendor through Nexa&rsquo;s WhatsApp number.</li>
          <li>3. The vendor replies on WhatsApp, still through Nexa.</li>
          <li>4. Phone numbers, account numbers, and direct-payment requests are blocked.</li>
        </ol>

        {href ? (
          <a href={href} className="mt-5 block">
            <Button className="w-full">Open WhatsApp</Button>
          </a>
        ) : (
          <p className="mt-5 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
            Nexa&rsquo;s WhatsApp number has not been added yet. Add NEXT_PUBLIC_WHATSAPP_NUMBER to enable this button.
          </p>
        )}
      </Card>
    </main>
  );
}


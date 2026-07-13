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
  const message = `Hi Nexa, I want to continue my booking. Ref: ${id}`;
  const href = number
    ? `https://wa.me/${number.replace(/\D/g, "")}?text=${encodeURIComponent(message)}`
    : null;

  return (
    <main className="mx-auto max-w-xl px-5 py-10">
      <PageHeader
        title="Continue your booking"
        subtitle="Use your booking reference so Nexa can keep the request organized and protected."
      />

      <Card>
        <p className="text-sm text-[color:var(--color-ink-muted)]">
          Keep all booking details and payment steps connected to this request. Nexa keeps a record for escrow, support, and dispute protection.
        </p>

        {href ? (
          <a href={href} className="mt-5 block">
            <Button className="w-full">Continue</Button>
          </a>
        ) : (
          <p className="mt-5 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
            This booking channel is not ready yet. Please contact Nexa support.
          </p>
        )}
      </Card>
    </main>
  );
}

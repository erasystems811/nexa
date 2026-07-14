import { notFound } from "next/navigation";
import { requireSession } from "@/modules/auth";
import { getConversation } from "@/modules/messaging";
import { publicEnv } from "@/lib/env";
import { Button, Card, PageHeader } from "@/components/ui";
import { BackBar } from "@/components/back-bar";

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
      <BackBar fallback="/orders" className="mb-4" />
      <PageHeader
        title="Chat on WhatsApp"
        subtitle="You are messaging Nexa's WhatsApp number. You never see the vendor's number, and they never see yours."
      />

      <Card>
        <p className="text-sm text-[color:var(--color-ink-muted)]">
          Nexa passes your messages on and keeps the record — so the price you agree, the job you
          asked for, and the money being held all stay connected to one request.
        </p>

        {href ? (
          <a href={href} className="mt-5 block">
            <Button className="w-full">Chat on WhatsApp</Button>
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

import { NextResponse, type NextRequest } from "next/server";
import { serverEnv } from "@/lib/env";
import { handleIncomingWhatsappText } from "@/modules/messaging/whatsapp";

export async function GET(request: NextRequest) {
  const env = serverEnv();
  const search = request.nextUrl.searchParams;
  const mode = search.get("hub.mode");
  const token = search.get("hub.verify_token");
  const challenge = search.get("hub.challenge");

  if (mode === "subscribe" && token && token === env.WHATSAPP_VERIFY_TOKEN) {
    return new NextResponse(challenge ?? "", { status: 200 });
  }

  return new NextResponse("Forbidden", { status: 403 });
}

export async function POST(request: NextRequest) {
  const payload = await request.json();
  const entries = Array.isArray(payload.entry) ? payload.entry : [];

  for (const entry of entries) {
    const changes = Array.isArray(entry.changes) ? entry.changes : [];
    for (const change of changes) {
      const value = change.value ?? {};
      const businessPhoneId = value.metadata?.phone_number_id;
      const contacts = new Map<string, string | undefined>();

      for (const contact of Array.isArray(value.contacts) ? value.contacts : []) {
        if (contact.wa_id) contacts.set(contact.wa_id, contact.profile?.name);
      }

      for (const message of Array.isArray(value.messages) ? value.messages : []) {
        if (message.type !== "text" || !message.text?.body || !message.from || !message.id) {
          continue;
        }

        await handleIncomingWhatsappText({
          waId: message.from,
          displayName: contacts.get(message.from),
          text: message.text.body,
          externalMessageId: message.id,
          businessPhoneId,
        });
      }
    }
  }

  return NextResponse.json({ ok: true });
}

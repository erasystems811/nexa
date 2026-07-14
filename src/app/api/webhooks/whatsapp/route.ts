import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { serverEnv } from "@/lib/env";
import { handleIncomingWhatsappText } from "@/modules/messaging/whatsapp";

/**
 * Meta's WhatsApp webhook.
 *
 * GET is the one-time handshake: Meta calls it with the verify token you typed
 * into the dashboard, and echoes back a challenge if it matches. Set
 * WHATSAPP_VERIFY_TOKEN to any secret string; it is a password, nothing more.
 *
 * POST is inbound messages, and it is signed. Meta HMACs the raw request body
 * with the app secret and sends it as `x-hub-signature-256`. Without checking
 * that, anyone who found this URL could inject messages into a customer's
 * conversation with a vendor — and this is the channel a price gets agreed on.
 * So an unsigned or badly-signed POST is refused, and a missing app secret means
 * refused too: no secret means the request cannot be authenticated, which is not
 * the same as it being safe.
 */

function signatureIsValid(rawBody: string, header: string | null, appSecret: string): boolean {
  if (!header?.startsWith("sha256=")) return false;

  const expected = createHmac("sha256", appSecret).update(rawBody, "utf8").digest("hex");
  const given = header.slice("sha256=".length);

  // Both hex-decoded to the same fixed length, so timingSafeEqual cannot throw
  // and cannot leak the length of the secret.
  const a = Buffer.from(expected, "hex");
  const b = Buffer.from(given, "hex");
  if (a.length !== b.length || a.length === 0) return false;

  return timingSafeEqual(a, b);
}

export async function GET(request: NextRequest) {
  const env = serverEnv();
  const search = request.nextUrl.searchParams;
  const mode = search.get("hub.mode");
  const token = search.get("hub.verify_token");
  const challenge = search.get("hub.challenge");

  if (mode === "subscribe" && token && env.WHATSAPP_VERIFY_TOKEN && token === env.WHATSAPP_VERIFY_TOKEN) {
    return new NextResponse(challenge ?? "", { status: 200 });
  }

  return new NextResponse("Forbidden", { status: 403 });
}

export async function POST(request: NextRequest) {
  const env = serverEnv();

  if (!env.WHATSAPP_APP_SECRET) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  // The signature is over the EXACT bytes Meta sent. Parsing first and
  // re-serialising would change them, and the check would never pass.
  const rawBody = await request.text();

  if (!signatureIsValid(rawBody, request.headers.get("x-hub-signature-256"), env.WHATSAPP_APP_SECRET)) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return new NextResponse("Bad request", { status: 400 });
  }

  const entries = Array.isArray((payload as { entry?: unknown }).entry)
    ? (payload as { entry: unknown[] }).entry
    : [];

  for (const entry of entries) {
    const changes = Array.isArray((entry as { changes?: unknown }).changes)
      ? (entry as { changes: unknown[] }).changes
      : [];

    for (const change of changes) {
      const value = ((change as { value?: Record<string, unknown> }).value ?? {}) as {
        metadata?: { phone_number_id?: string };
        contacts?: Array<{ wa_id?: string; profile?: { name?: string } }>;
        messages?: Array<{
          type?: string;
          text?: { body?: string };
          from?: string;
          id?: string;
        }>;
      };

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

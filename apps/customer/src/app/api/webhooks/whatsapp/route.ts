import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { serverEnv } from "@/lib/env";
import { handleIncomingWhatsappText, handleListingSelected, handleOfferButtonReply, handleBookingButtonReply } from "@/modules/messaging/whatsapp";
import { isEnabled, FLAGS } from "@/modules/settings/flags";

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

/**
 * Bali (a separate ERA client chatbot) shares this Meta app/WABA and access
 * token via a second phone number, so Meta only lets us register one webhook
 * URL for both. This forwards Bali's messages to Bali's own n8n instance,
 * untouched and unprocessed by any Nexa logic -- full isolation, this route
 * is purely a dumb relay for anything that isn't Nexa's own phone_number_id.
 */
async function forwardToBali(entryId: string, value: unknown): Promise<void> {
  const env = serverEnv();
  if (!env.BALI_WEBHOOK_URL || !env.BALI_FORWARD_SECRET) {
    console.error("Bali webhook message received but BALI_WEBHOOK_URL/BALI_FORWARD_SECRET are not configured -- dropped");
    return;
  }

  const forwardedPayload = {
    object: "whatsapp_business_account",
    entry: [{ id: entryId, changes: [{ field: "messages", value }] }],
  };

  try {
    await fetch(env.BALI_WEBHOOK_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-bali-forward-secret": env.BALI_FORWARD_SECRET,
      },
      body: JSON.stringify(forwardedPayload),
    });
  } catch (error) {
    // Bali's own problem to retry/alert on from here; Nexa must not fail
    // Meta's webhook delivery over Bali being down.
    console.error("Failed to forward WhatsApp message to Bali", error);
  }
}

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

  // Gates Nexa's OWN message handling only, checked per-change below --
  // Bali's forwarding must never depend on Nexa's feature flag, since they
  // are unrelated bots sharing only the Meta app/webhook URL.
  const nexaChatEnabled = await isEnabled(FLAGS.whatsappMediatedChat);

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
          interactive?: {
            type?: string;
            list_reply?: { id?: string; title?: string };
            button_reply?: { id?: string; title?: string };
          };
          from?: string;
          id?: string;
        }>;
        // Delivery receipts for messages Nexa sent (sent/delivered/read/failed).
        // Meta only sends these once the `statuses` webhook field is subscribed
        // in WhatsApp Manager - logged here, not acted on, purely so a failed
        // send shows its actual reason in Railway logs instead of vanishing.
        statuses?: Array<{
          id?: string;
          status?: string;
          recipient_id?: string;
          errors?: Array<{ code?: number; title?: string; message?: string }>;
        }>;
      };

      const businessPhoneId = value.metadata?.phone_number_id;

      if (businessPhoneId && businessPhoneId === env.BALI_WHATSAPP_PHONE_NUMBER_ID) {
        await forwardToBali((entry as { id?: string }).id ?? "", value);
        continue;
      }

      // Still 200 when the feature is off, or Meta reads repeated non-2xx
      // responses as "this webhook is broken" and disables it. Only skips
      // Nexa's own handling -- Bali's forward above already happened.
      if (!nexaChatEnabled) continue;

      const contacts = new Map<string, string | undefined>();

      for (const contact of Array.isArray(value.contacts) ? value.contacts : []) {
        if (contact.wa_id) contacts.set(contact.wa_id, contact.profile?.name);
      }

      for (const message of Array.isArray(value.messages) ? value.messages : []) {
        if (!message.from || !message.id) continue;

        if (message.type === "text" && message.text?.body) {
          await handleIncomingWhatsappText({
            waId: message.from,
            displayName: contacts.get(message.from),
            text: message.text.body,
            externalMessageId: message.id,
            businessPhoneId,
          });
          continue;
        }

        if (message.type === "interactive" && message.interactive?.list_reply?.id) {
          await handleListingSelected({
            waId: message.from,
            listingId: message.interactive.list_reply.id,
          });
          continue;
        }

        if (message.type === "interactive" && message.interactive?.button_reply?.id) {
          const buttonId = message.interactive.button_reply.id;
          const wasBookingButton = await handleBookingButtonReply({ waId: message.from, buttonId });
          if (!wasBookingButton) {
            await handleOfferButtonReply({ waId: message.from, buttonId });
          }
          continue;
        }
      }

      for (const status of Array.isArray(value.statuses) ? value.statuses : []) {
        if (status.errors?.length) {
          console.error("WhatsApp delivery status (failed)", JSON.stringify(status));
        } else {
          console.log("WhatsApp delivery status", status.id, status.status, status.recipient_id);
        }
      }
    }
  }

  return NextResponse.json({ ok: true });
}
